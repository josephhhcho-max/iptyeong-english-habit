import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MySentencesSection from '../components/MySentencesSection';
import ShareButton from '../components/ShareButton';
import SimilarSection from '../components/SimilarSection';
import SpeakButton from '../components/SpeakButton';
import SpeedToggle from '../components/SpeedToggle';
import { buildExpressionShareText } from '../lib/share';
import { getExpression, getSession, updateExpression } from '../lib/store';
import type { Expression, Session } from '../types';

export default function ExpressionDetail() {
  const { id } = useParams<{ id: string }>();
  const [expression, setExpression] = useState<Expression | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const expr = id ? getExpression(id) : null;
    setExpression(expr);
    setSession(expr ? getSession(expr.sessionId) : null);
  }, [id]);

  if (!expression) {
    return (
      <section className="space-y-3">
        <Link
          to="/today"
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 dark:text-sky-400"
        >
          ← Today
        </Link>
        <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-4 text-sm text-slate-600 dark:text-slate-400">
          표현을 찾을 수 없습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to="/today"
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
        >
          ← Today
        </Link>
        <SpeedToggle />
      </div>

      <header className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold leading-snug text-slate-900 dark:text-slate-100">
            {expression.english}
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            <ShareButton
              size="md"
              title={expression.english}
              text={buildExpressionShareText(expression, session)}
              ariaLabel="이 표현 공유"
            />
            <BookmarkToggle
              expression={expression}
              onUpdated={setExpression}
            />
            <SpeakButton
              text={expression.english}
              size="md"
              ariaLabel="영어 표현 발음 재생"
            />
          </div>
        </div>
        <p className="mt-2 text-base text-slate-700 dark:text-slate-300">{expression.korean}</p>
        <span className="mt-3 inline-block rounded-full bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
          {expression.type}
        </span>
      </header>

      {expression.exampleFromText && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              교재 예문
            </h2>
            <SpeakButton
              text={expression.exampleFromText}
              ariaLabel="예문 발음 재생"
            />
          </div>
          <p className="mt-2 text-sm italic leading-relaxed text-slate-700 dark:text-slate-300">
            “{expression.exampleFromText}”
          </p>
        </section>
      )}

      <SimilarSection
        expression={expression}
        onExpressionUpdated={setExpression}
      />

      <MySentencesSection
        expression={expression}
        onExpressionUpdated={setExpression}
      />

      {session && (
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
          출처: {session.topic} ·{' '}
          {new Date(session.createdAt).toLocaleDateString()} · {session.weekKey}
        </p>
      )}
    </section>
  );
}

function BookmarkToggle({
  expression,
  onUpdated,
}: {
  expression: Expression;
  onUpdated: (next: Expression) => void;
}) {
  const active = Boolean(expression.bookmarked);
  return (
    <button
      type="button"
      onClick={() => {
        const updated = updateExpression(expression.id, { bookmarked: !active });
        if (updated) onUpdated(updated);
      }}
      aria-label={active ? '갈무리 해제' : '갈무리 저장'}
      aria-pressed={active}
      className={[
        'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
        active
          ? 'bg-amber-500 text-white hover:bg-amber-600'
          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-amber-100 hover:text-amber-700',
      ].join(' ')}
    >
      <span aria-hidden="true">{active ? '★' : '☆'}</span>
    </button>
  );
}
