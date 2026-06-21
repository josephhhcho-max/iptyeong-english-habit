import { Link } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import { listWeekSummaries } from '../lib/review';

function formatWeekKey(weekKey: string): string {
  // "2026-W25" → "2026년 25주차"
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return weekKey;
  return `${m[1]}년 ${parseInt(m[2], 10)}주차`;
}

export default function Review() {
  const weeks = listWeekSummaries();

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Review</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          주차별로 모아 복습하고 암기 상태를 점검하세요.
        </p>
      </header>

      {weeks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            아직 추출한 표현이 없어요.
          </p>
          <Link
            to="/today"
            className="mt-3 inline-block rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Today에서 시작하기 →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {weeks.map((w) => (
            <li key={w.weekKey}>
              <Link
                to={`/review/${w.weekKey}`}
                className="block rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50/40 active:bg-sky-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatWeekKey(w.weekKey)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {w.sessionCount}회 세션 · {w.total}개 표현
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {Math.round(w.rate * 100)}%
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {w.memorized} / {w.total}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <ProgressBar
                    value={w.rate}
                    tone={w.rate >= 1 ? 'emerald' : 'sky'}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
