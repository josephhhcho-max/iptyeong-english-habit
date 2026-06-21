import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getActivityDays, getDayActivity } from '../lib/review';
import type { DayActivity } from '../lib/review';

const DOW_KOR = ['일', '월', '화', '수', '목', '금', '토'] as const;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function buildMonthGrid(viewMonth: Date): Date[] {
  // Pad start to Sunday, end to Saturday. 35 or 42 cells.
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstOfMonth.getDay(); // 0=Sun
  const start = new Date(year, month, 1 - startDayOfWeek);
  const cells: Date[] = [];
  // 6 weeks always — keeps layout stable across months.
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
}

export default function History() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState<Date>(today);

  const activityDays = useMemo(() => getActivityDays(), []);
  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const dayActivity = useMemo(() => getDayActivity(selected), [selected]);

  function prevMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  const monthLabel = `${viewMonth.getFullYear()}년 ${viewMonth.getMonth() + 1}월`;
  const selectedLabel = `${selected.getFullYear()}년 ${selected.getMonth() + 1}월 ${selected.getDate()}일`;

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          기록
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          날짜를 선택해 그 날의 학습 기록을 확인하세요.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="이전 달"
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            ◀
          </button>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {monthLabel}
          </p>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="다음 달"
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            ▶
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-0.5 text-center">
          {DOW_KOR.map((d, i) => (
            <div
              key={d}
              className={[
                'pb-1 text-[10px] font-semibold uppercase',
                i === 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : i === 6
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-slate-500 dark:text-slate-400',
              ].join(' ')}
            >
              {d}
            </div>
          ))}
          {cells.map((cell) => {
            const inMonth = sameMonth(cell, viewMonth);
            const key = ymd(cell);
            const hasActivity = activityDays.has(key);
            const isSelected = ymd(cell) === ymd(selected);
            const isToday = ymd(cell) === ymd(today);
            const dow = cell.getDay();
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(cell)}
                aria-pressed={isSelected}
                aria-label={`${cell.getMonth() + 1}월 ${cell.getDate()}일`}
                className={[
                  'relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition-colors',
                  inMonth
                    ? dow === 0
                      ? 'text-rose-700 dark:text-rose-300'
                      : dow === 6
                        ? 'text-sky-700 dark:text-sky-300'
                        : 'text-slate-800 dark:text-slate-200'
                    : 'text-slate-300 dark:text-slate-600',
                  isSelected
                    ? 'bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500'
                    : isToday
                      ? 'ring-1 ring-sky-400 dark:ring-sky-600'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700',
                ].join(' ')}
              >
                <span>{cell.getDate()}</span>
                {hasActivity && (
                  <span
                    className={[
                      'mt-0.5 h-1 w-1 rounded-full',
                      isSelected ? 'bg-white' : 'bg-sky-500 dark:bg-sky-400',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <DayDetail label={selectedLabel} activity={dayActivity} />
    </section>
  );
}

function DayDetail({
  label,
  activity,
}: {
  label: string;
  activity: DayActivity;
}) {
  const empty =
    activity.sessions.length === 0 &&
    activity.expressionsAdded.length === 0 &&
    activity.conversationMessages.length === 0 &&
    activity.writings.length === 0;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {label}
      </h2>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            이 날 학습한 내용이 없어요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.sessions.length > 0 && (
            <Card title={`세션 (${activity.sessions.length})`}>
              <ul className="space-y-1.5">
                {activity.sessions.map((s) => (
                  <li
                    key={s.id}
                    className="text-sm text-slate-700 dark:text-slate-200"
                  >
                    <span className="font-medium">{s.topic}</span>
                    <span className="ml-2 text-[11px] text-slate-400">
                      {new Date(s.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {activity.expressionsAdded.length > 0 && (
            <Card title={`추출된 표현 (${activity.expressionsAdded.length})`}>
              <ul className="space-y-1">
                {activity.expressionsAdded.map((e) => (
                  <li key={e.id} className="text-sm">
                    <Link
                      to={`/expression/${e.id}`}
                      className="block rounded px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {e.english}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        {e.korean}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {activity.conversationMessages.length > 0 && (
            <Card title={`회화 메시지 (${activity.conversationMessages.length})`}>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activity.conversationMessages.length}개 메시지 — 자세히 보려면{' '}
                <Link
                  to="/conversation"
                  className="font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
                >
                  Conversation 탭으로
                </Link>
              </p>
            </Card>
          )}

          {activity.writings.length > 0 && (
            <Card title={`영작 (${activity.writings.length})`}>
              <ul className="space-y-1.5">
                {activity.writings.map((w) => (
                  <li key={w.id} className="text-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {w.prompt}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-slate-800 dark:text-slate-100">
                      {w.userText}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
