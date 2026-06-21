import { useState } from 'react';
import { enrichExpression } from '../lib/api';
import { updateExpression } from '../lib/store';
import type { Expression } from '../types';
import SpeakButton from './SpeakButton';

type Props = {
  expression: Expression;
  onExpressionUpdated: (next: Expression) => void;
};

export default function SimilarSection({ expression, onExpressionUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasResult =
    Array.isArray(expression.similar) || Array.isArray(expression.extraExamples);

  async function fetchEnrich() {
    setLoading(true);
    setError(null);
    try {
      const result = await enrichExpression({
        expression: { english: expression.english, korean: expression.korean },
      });
      const similar = Array.isArray(result.similar) ? result.similar : [];
      const extraExamples = Array.isArray(result.extraExamples) ? result.extraExamples : [];
      const updated = updateExpression(expression.id, { similar, extraExamples });
      if (updated) onExpressionUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          유사 표현
        </h2>
        {hasResult && (
          <button
            type="button"
            onClick={fetchEnrich}
            disabled={loading}
            className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 disabled:opacity-50"
          >
            {loading ? '다시 받는 중…' : '다시 받기'}
          </button>
        )}
      </div>

      {!hasResult && (
        <button
          type="button"
          onClick={fetchEnrich}
          disabled={loading}
          className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              생성 중…
            </span>
          ) : (
            '유사 표현 보기'
          )}
        </button>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {hasResult && expression.similar && expression.similar.length > 0 && (
        <ul className="mt-3 space-y-2">
          {expression.similar.map((s, i) => (
            <li
              key={`${i}-${s.en}`}
              className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{s.en}</p>
                <SpeakButton text={s.en} ariaLabel="유사 표현 발음 재생" />
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{s.ko}</p>
            </li>
          ))}
        </ul>
      )}

      {hasResult && expression.extraExamples && expression.extraExamples.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            추가 예문
          </h3>
          <ul className="space-y-2">
            {expression.extraExamples.map((ex, i) => (
              <li
                key={`${i}-${ex.slice(0, 16)}`}
                className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 p-3"
              >
                <p className="text-sm italic text-slate-700 dark:text-slate-300">“{ex}”</p>
                <SpeakButton text={ex} ariaLabel="예문 발음 재생" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasResult &&
        (!expression.similar || expression.similar.length === 0) &&
        (!expression.extraExamples || expression.extraExamples.length === 0) && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">생성된 항목이 없습니다.</p>
        )}
    </section>
  );
}
