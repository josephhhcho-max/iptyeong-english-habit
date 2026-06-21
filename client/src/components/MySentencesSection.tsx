import { useState } from 'react';
import { getSentenceFeedback } from '../lib/api';
import { newId, updateExpression } from '../lib/store';
import type { Expression, MyExample, SentenceFeedbackResponse } from '../types';
import SpeakButton from './SpeakButton';

type Props = {
  expression: Expression;
  onExpressionUpdated: (next: Expression) => void;
};

type PendingFeedback = {
  userSentence: string;
  response: SentenceFeedbackResponse;
};

export default function MySentencesSection({
  expression,
  onExpressionUpdated,
}: Props) {
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFeedback | null>(null);

  const saved = expression.myExamples ?? [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const userSentence = draft.trim();
    if (!userSentence || loading) return;
    setLoading(true);
    setError(null);
    setPending(null);
    try {
      const response = await getSentenceFeedback({
        expression: { english: expression.english, korean: expression.korean },
        userSentence,
      });
      setPending({ userSentence, response });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }

  function onSave() {
    if (!pending) return;
    const item: MyExample = {
      id: newId(),
      userSentence: pending.userSentence,
      isNatural: Boolean(pending.response.isNatural),
      corrected: pending.response.corrected ?? '',
      feedback: pending.response.feedback ?? '',
      better: pending.response.better ?? '',
      createdAt: new Date().toISOString(),
    };
    const next: MyExample[] = [...saved, item];
    const updated = updateExpression(expression.id, { myExamples: next });
    if (updated) onExpressionUpdated(updated);
    setDraft('');
    setPending(null);
    setError(null);
  }

  function onDiscard() {
    setPending(null);
    setError(null);
  }

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        내 문장
      </h2>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
        “{expression.english}” 를 활용한 영어 문장을 써보세요.
      </p>

      <form onSubmit={onSubmit} className="mt-3 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Write your sentence in English..."
          disabled={loading}
          className="w-full resize-y rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              첨삭 받는 중…
            </span>
          ) : (
            '첨삭 받기'
          )}
        </button>
      </form>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {pending && (
        <FeedbackCard
          item={pending}
          onSave={onSave}
          onDiscard={onDiscard}
          highlight
        />
      )}

      {saved.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            저장된 내 문장 ({saved.length})
          </h3>
          <ul className="space-y-2">
            {[...saved].reverse().map((item) => (
              <SavedExampleCard key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function NaturalBadge({ isNatural }: { isNatural: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        isNatural
          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
          : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
      ].join(' ')}
    >
      {isNatural ? '✓ Natural' : '! Needs work'}
    </span>
  );
}

function FeedbackCard({
  item,
  onSave,
  onDiscard,
  highlight,
}: {
  item: PendingFeedback;
  onSave: () => void;
  onDiscard: () => void;
  highlight?: boolean;
}) {
  const { userSentence, response } = item;
  return (
    <div
      className={[
        'mt-3 space-y-3 rounded-xl border p-3',
        highlight ? 'border-sky-200 bg-sky-50/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <NaturalBadge isNatural={Boolean(response.isNatural)} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
          >
            버리기
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
          >
            이 문장 저장
          </button>
        </div>
      </div>

      <FieldRow label="내가 쓴 문장" value={userSentence} />

      {response.corrected && response.corrected !== userSentence && (
        <FieldRow label="교정문" value={response.corrected} speakable />
      )}

      {response.feedback && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            피드백
          </p>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{response.feedback}</p>
        </div>
      )}

      {response.better && (
        <FieldRow label="더 자연스러운 표현" value={response.better} speakable />
      )}
    </div>
  );
}

function SavedExampleCard({ item }: { item: MyExample }) {
  return (
    <li className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <NaturalBadge isNatural={item.isNatural} />
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      </div>
      <FieldRow label="내가 쓴 문장" value={item.userSentence} className="mt-2" />
      {item.corrected && item.corrected !== item.userSentence && (
        <FieldRow label="교정문" value={item.corrected} speakable className="mt-2" />
      )}
      {item.feedback && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            피드백
          </p>
          <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">{item.feedback}</p>
        </div>
      )}
      {item.better && (
        <FieldRow
          label="더 자연스러운 표현"
          value={item.better}
          speakable
          className="mt-2"
        />
      )}
    </li>
  );
}

function FieldRow({
  label,
  value,
  speakable,
  className,
}: {
  label: string;
  value: string;
  speakable?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className="mt-0.5 flex items-start justify-between gap-2">
        <p className="text-sm text-slate-800 dark:text-slate-200">{value}</p>
        {speakable && <SpeakButton text={value} ariaLabel={`${label} 발음 재생`} />}
      </div>
    </div>
  );
}
