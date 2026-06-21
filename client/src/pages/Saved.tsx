import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ShareButton from '../components/ShareButton';
import SpeakButton from '../components/SpeakButton';
import { buildExpressionShareText } from '../lib/share';
import {
  getSession,
  listBookmarkedExpressions,
  listStruggledExpressions,
} from '../lib/store';
import type { Expression } from '../types';

type Filter = 'bookmarked' | 'struggled' | 'all';

export default function Saved() {
  const [filter, setFilter] = useState<Filter>('bookmarked');

  const items = useMemo(() => {
    if (filter === 'bookmarked') return listBookmarkedExpressions();
    if (filter === 'struggled') return listStruggledExpressions();
    const seen = new Set<string>();
    const combined: Expression[] = [];
    for (const e of [
      ...listBookmarkedExpressions(),
      ...listStruggledExpressions(),
    ]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      combined.push(e);
    }
    return combined;
  }, [filter]);

  const counts = useMemo(
    () => ({
      bookmarked: listBookmarkedExpressions().length,
      struggled: listStruggledExpressions().length,
    }),
    [],
  );

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          갈무리
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          따로 모아둔 표현과 다시 봐야 할 표현을 한곳에서 보세요.
        </p>
      </header>

      <div
        role="group"
        aria-label="필터"
        className="inline-flex w-full items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        <FilterTab
          label="★ 갈무리"
          count={counts.bookmarked}
          active={filter === 'bookmarked'}
          onClick={() => setFilter('bookmarked')}
        />
        <FilterTab
          label="다시 본 표현"
          count={counts.struggled}
          active={filter === 'struggled'}
          onClick={() => setFilter('struggled')}
        />
        <FilterTab
          label="전체"
          count={counts.bookmarked + counts.struggled}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
          {filter === 'bookmarked' ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                아직 갈무리한 표현이 없어요.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                표현 상세 화면 우측 상단의 ☆ 버튼을 누르면 여기에 모입니다.
              </p>
            </>
          ) : filter === 'struggled' ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              복습에서 “다시” 표시한 표현이 아직 없어요.
            </p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              모아둔 표현이 없습니다.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => (
            <li key={e.id}>
              <Link
                to={`/expression/${e.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50/40 active:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-700 dark:hover:bg-sky-900/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {e.english}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      {e.korean}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ShareButton
                      title={e.english}
                      text={buildExpressionShareText(e, getSession(e.sessionId))}
                      ariaLabel="이 표현 공유"
                    />
                    <SpeakButton text={e.english} ariaLabel="발음 재생" />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:bg-sky-900/60 dark:text-sky-200">
                    {e.type}
                  </span>
                  {e.bookmarked && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                      ★ 갈무리
                    </span>
                  )}
                  {e.lastReviewed && e.memorized === false && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/60 dark:text-rose-200">
                      다시
                    </span>
                  )}
                  {e.memorized && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                      ✓ 암기
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-white text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-300'
          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
      ].join(' ')}
    >
      {label} <span className="ml-1 opacity-70">{count}</span>
    </button>
  );
}
