import { openDB, type IDBPDatabase } from 'idb';
import type { ChatMessage, Expression, Session, WritingPiece } from '../types';

const LS_SESSIONS = 'iptyeong.sessions.v1';
const LS_EXPRESSIONS = 'iptyeong.expressions.v1';
const LS_CONVERSATIONS = 'iptyeong.conversations.v1';
const LS_WRITINGS = 'iptyeong.writings.v1';

const DB_NAME = 'iptyeong';
const DB_VERSION = 1;
const IMAGE_STORE = 'images';

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE);
        }
      },
    });
  }
  return dbPromise;
}

// ---------- IndexedDB: image blobs ----------

export async function saveImage(id: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put(IMAGE_STORE, blob, id);
}

export async function getImage(id: string): Promise<Blob | null> {
  const db = await getDB();
  const blob = (await db.get(IMAGE_STORE, id)) as Blob | undefined;
  return blob ?? null;
}

export async function deleteImage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(IMAGE_STORE, id);
}

// ---------- localStorage: structured data ----------

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function listSessions(): Session[] {
  return readJSON<Session[]>(LS_SESSIONS, []);
}

export function getLatestSession(): Session | null {
  const all = listSessions();
  if (all.length === 0) return null;
  return all.reduce((latest, s) =>
    latest && latest.createdAt > s.createdAt ? latest : s,
  );
}

export function getSession(id: string): Session | null {
  return listSessions().find((s) => s.id === id) ?? null;
}

export function saveSession(session: Session): void {
  const all = listSessions().filter((s) => s.id !== session.id);
  all.push(session);
  writeJSON(LS_SESSIONS, all);
}

export async function deleteSession(id: string): Promise<void> {
  const session = getSession(id);
  const sessions = listSessions().filter((s) => s.id !== id);
  writeJSON(LS_SESSIONS, sessions);
  const exprs = listAllExpressions().filter((e) => e.sessionId !== id);
  writeJSON(LS_EXPRESSIONS, exprs);
  if (session?.imageId) {
    await deleteImage(session.imageId).catch(() => {});
  }
}

export function listAllExpressions(): Expression[] {
  return readJSON<Expression[]>(LS_EXPRESSIONS, []);
}

export function listExpressions(sessionId: string): Expression[] {
  return listAllExpressions().filter((e) => e.sessionId === sessionId);
}

export function getExpression(id: string): Expression | null {
  return listAllExpressions().find((e) => e.id === id) ?? null;
}

export function updateExpression(
  id: string,
  patch: Partial<Expression>,
): Expression | null {
  const all = listAllExpressions();
  const idx = all.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  const updated = { ...all[idx], ...patch, id: all[idx].id };
  all[idx] = updated;
  writeJSON(LS_EXPRESSIONS, all);
  return updated;
}

export function listBookmarkedExpressions(): Expression[] {
  return listAllExpressions().filter((e) => e.bookmarked);
}

export function listStruggledExpressions(): Expression[] {
  // "오답" candidates — reviewed at least once but explicitly marked as
  // 다시 (memorized=false after review). Excludes never-reviewed cards.
  return listAllExpressions().filter(
    (e) => e.lastReviewed && e.memorized === false,
  );
}

export function saveExpressions(items: Expression[]): void {
  if (items.length === 0) return;
  const incomingIds = new Set(items.map((e) => e.id));
  const rest = listAllExpressions().filter((e) => !incomingIds.has(e.id));
  writeJSON(LS_EXPRESSIONS, [...rest, ...items]);
}

// ---------- conversations (per-session chat history) ----------

type ConversationsMap = Record<string, ChatMessage[]>;

function readConversations(): ConversationsMap {
  return readJSON<ConversationsMap>(LS_CONVERSATIONS, {});
}

export function getConversation(sessionId: string): ChatMessage[] {
  return readConversations()[sessionId] ?? [];
}

export function setConversation(sessionId: string, messages: ChatMessage[]): void {
  const all = readConversations();
  if (messages.length === 0) {
    delete all[sessionId];
  } else {
    all[sessionId] = messages;
  }
  writeJSON(LS_CONVERSATIONS, all);
}

export function appendConversation(
  sessionId: string,
  message: ChatMessage,
): ChatMessage[] {
  const next = [...getConversation(sessionId), message];
  setConversation(sessionId, next);
  return next;
}

export function clearConversation(sessionId: string): void {
  setConversation(sessionId, []);
}

// ---------- writings (영작 + 첨삭) ----------

export function listWritings(sessionId?: string): WritingPiece[] {
  const all = readJSON<WritingPiece[]>(LS_WRITINGS, []);
  const filtered = sessionId ? all.filter((w) => w.sessionId === sessionId) : all;
  // Newest first.
  return [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getWriting(id: string): WritingPiece | null {
  return readJSON<WritingPiece[]>(LS_WRITINGS, []).find((w) => w.id === id) ?? null;
}

export function saveWriting(piece: WritingPiece): void {
  const all = readJSON<WritingPiece[]>(LS_WRITINGS, []).filter((w) => w.id !== piece.id);
  all.push(piece);
  writeJSON(LS_WRITINGS, all);
}

export function deleteWriting(id: string): void {
  const all = readJSON<WritingPiece[]>(LS_WRITINGS, []).filter((w) => w.id !== id);
  writeJSON(LS_WRITINGS, all);
}

// ---------- helpers ----------

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random — fine for a single-user app.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
