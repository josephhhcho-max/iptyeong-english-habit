import { listAllExpressions, listSessions, listWritings } from './store';
import type { ChatMessage, Expression, Session, WritingPiece } from '../types';
import { getConversation } from './store';
import { isoWeekKey } from './week';

export type WeekSummary = {
  weekKey: string;
  sessionCount: number;
  total: number;
  memorized: number;
  rate: number; // 0..1
};

function summarizeWeek(weekKey: string, sessions: Session[]): WeekSummary {
  const sessionIds = new Set(sessions.map((s) => s.id));
  const all = listAllExpressions();
  const exprs = all.filter((e) => sessionIds.has(e.sessionId));
  const memorized = exprs.filter((e) => e.memorized).length;
  return {
    weekKey,
    sessionCount: sessions.length,
    total: exprs.length,
    memorized,
    rate: exprs.length === 0 ? 0 : memorized / exprs.length,
  };
}

export function listWeekSummaries(): WeekSummary[] {
  const sessions = listSessions();
  const byWeek = new Map<string, Session[]>();
  for (const s of sessions) {
    const list = byWeek.get(s.weekKey) ?? [];
    list.push(s);
    byWeek.set(s.weekKey, list);
  }

  const result: WeekSummary[] = [];
  for (const [weekKey, group] of byWeek.entries()) {
    result.push(summarizeWeek(weekKey, group));
  }
  // ISO week keys sort lexicographically the same as chronologically, so a
  // simple desc string sort puts the latest week first.
  result.sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1));
  return result;
}

export function getExpressionsForWeek(weekKey: string): Expression[] {
  const sessions = listSessions().filter((s) => s.weekKey === weekKey);
  const sessionIds = new Set(sessions.map((s) => s.id));
  return listAllExpressions().filter((e) => sessionIds.has(e.sessionId));
}

export function currentWeekSummary(): WeekSummary | null {
  const key = isoWeekKey();
  const sessions = listSessions().filter((s) => s.weekKey === key);
  if (sessions.length === 0) return null;
  return summarizeWeek(key, sessions);
}

export type OverallStats = {
  sessionCount: number;
  expressionCount: number;
  memorizedCount: number;
  rate: number;
  myExamplesCount: number;
  writingCount: number;
  bookmarkedCount: number;
};

export function overallStats(): OverallStats {
  const sessions = listSessions();
  const exprs = listAllExpressions();
  const memorized = exprs.filter((e) => e.memorized).length;
  const myExamples = exprs.reduce((sum, e) => sum + (e.myExamples?.length ?? 0), 0);
  const bookmarked = exprs.filter((e) => e.bookmarked).length;
  const writings = listWritings();
  return {
    sessionCount: sessions.length,
    expressionCount: exprs.length,
    memorizedCount: memorized,
    rate: exprs.length === 0 ? 0 : memorized / exprs.length,
    myExamplesCount: myExamples,
    writingCount: writings.length,
    bookmarkedCount: bookmarked,
  };
}

// ---------- streak ----------

function dateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toDateString();
}

/**
 * Consecutive learning-day streak. A "learning day" is one where at least
 * one session was created. Allows a one-day grace: if today has no session
 * but yesterday does, the streak still counts (encourages today's session).
 */
export function calculateStreak(now: Date = new Date()): number {
  const sessions = listSessions();
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map((s) => dateKey(s.createdAt)));

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  if (!days.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dateKey(cursor))) return 0;
  }

  let count = 0;
  while (days.has(dateKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function hasSessionToday(now: Date = new Date()): boolean {
  const today = dateKey(now);
  return listSessions().some((s) => dateKey(s.createdAt) === today);
}

// ---------- calendar ----------

export type DayActivity = {
  date: string; // YYYY-MM-DD (local)
  sessions: Session[];
  expressionsAdded: Expression[];
  conversationMessages: ChatMessage[]; // messages whose createdAt falls on this date
  writings: WritingPiece[];
};

function localYMD(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDayActivity(target: Date): DayActivity {
  const key = localYMD(target);
  const sessions = listSessions().filter((s) => localYMD(s.createdAt) === key);
  const expressions = listAllExpressions().filter(
    (e) => localYMD(e.createdAt) === key,
  );
  const writings = listWritings().filter((w) => localYMD(w.createdAt) === key);

  // Conversation messages: gather across all session conversations whose
  // messages fall on this date.
  const allSessions = listSessions();
  const conversationMessages: ChatMessage[] = [];
  for (const s of allSessions) {
    const msgs = getConversation(s.id);
    for (const m of msgs) {
      if (localYMD(m.createdAt) === key) conversationMessages.push(m);
    }
  }

  return {
    date: key,
    sessions,
    expressionsAdded: expressions,
    conversationMessages,
    writings,
  };
}

/** Set of YYYY-MM-DD strings with ANY learning activity. Used to paint dots
 *  on the calendar grid. */
export function getActivityDays(): Set<string> {
  const days = new Set<string>();
  for (const s of listSessions()) days.add(localYMD(s.createdAt));
  for (const e of listAllExpressions()) days.add(localYMD(e.createdAt));
  for (const w of listWritings()) days.add(localYMD(w.createdAt));
  for (const s of listSessions()) {
    for (const m of getConversation(s.id)) days.add(localYMD(m.createdAt));
  }
  return days;
}

// Compare typed/spoken input against the expected English. We normalize for:
//   - case (lowercase)
//   - whitespace (collapse + trim)
//   - punctuation (Whisper sprinkles periods, commas, question marks on speech;
//     keyboard answers may or may not include them)
//   - curly vs straight apostrophes (Whisper emits “smart” punctuation)
// Apostrophes themselves are preserved so contractions stay meaningful.
export function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAnswerCorrect(typed: string, expected: string): boolean {
  return normalizeForCompare(typed) === normalizeForCompare(expected);
}
