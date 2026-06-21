import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import SpeakButton from '../components/SpeakButton';
import SpeedToggle from '../components/SpeedToggle';
import {
  getExpressionsForWeek,
  isAnswerCorrect,
  listWeekSummaries,
} from '../lib/review';
import { updateExpression } from '../lib/store';
import { useWhisperRecorder } from '../lib/useWhisperRecorder';
import type { Expression } from '../types';

type Mode = 'speak' | 'type';

function formatWeekKey(weekKey: string): string {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return weekKey;
  return `${m[1]}년 ${parseInt(m[2], 10)}주차`;
}

export default function Flashcards() {
  const { weekKey: rawKey } = useParams<{ weekKey: string }>();
  const weekKey = rawKey ?? '';

  const [expressions, setExpressions] = useState<Expression[]>(() =>
    weekKey ? getExpressionsForWeek(weekKey) : [],
  );
  const [mode, setMode] = useState<Mode>('speak');
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState('');
  const [typedResult, setTypedResult] = useState<'correct' | 'incorrect' | null>(null);

  const sr = useWhisperRecorder();

  useEffect(() => {
    setExpressions(weekKey ? getExpressionsForWeek(weekKey) : []);
    setIndex(0);
    setRevealed(false);
    setTyped('');
    setTypedResult(null);
    sr.reset();
    // sr.reset is stable enough for our purposes; we only want this on weekKey change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  const total = expressions.length;
  const finished = total > 0 && index >= total;
  const current = !finished && total > 0 ? expressions[index] : null;

  // Auto-grade in speak mode when recognition ends with non-empty transcript.
  const gradedTranscriptRef = useRef<string>('');
  useEffect(() => {
    if (mode !== 'speak') return;
    if (revealed) return;
    if (sr.listening) return;
    const trimmed = sr.transcript.trim();
    if (!trimmed) return;
    if (gradedTranscriptRef.current === trimmed) return;
    if (!current) return;
    gradedTranscriptRef.current = trimmed;
    const ok = isAnswerCorrect(trimmed, current.english);
    setTypedResult(ok ? 'correct' : 'incorrect');
    setTyped(trimmed);
    setRevealed(true);
  }, [mode, revealed, sr.listening, sr.transcript, current]);

  function changeMode(m: Mode) {
    if (m !== 'speak' && sr.listening) sr.stop();
    setMode(m);
  }

  function reveal() {
    if (sr.listening) sr.stop();
    setRevealed(true);
  }

  function onSubmitTyped(e?: React.FormEvent) {
    e?.preventDefault();
    if (!current) return;
    const ok = isAnswerCorrect(typed, current.english);
    setTypedResult(ok ? 'correct' : 'incorrect');
    setRevealed(true);
  }

  function markAndAdvance(memorized: boolean) {
    if (!current) return;
    const updated = updateExpression(current.id, {
      memorized,
      lastReviewed: new Date().toISOString(),
    });
    if (updated) {
      setExpressions((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
    }
    setRevealed(false);
    setTyped('');
    setTypedResult(null);
    sr.reset();
    gradedTranscriptRef.current = '';
    setIndex((i) => i + 1);
  }

  function restart() {
    setExpressions(weekKey ? getExpressionsForWeek(weekKey) : []);
    setIndex(0);
    setRevealed(false);
    setTyped('');
    setTypedResult(null);
    sr.reset();
    gradedTranscriptRef.current = '';
  }

  // ---------- empty / finished states ----------

  if (total === 0) {
    return (
      <section className="space-y-3">
        <Link
          to="/review"
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 dark:text-sky-400"
        >
          ← Review
        </Link>
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            이 주차에는 복습할 표현이 없어요.
          </p>
        </div>
      </section>
    );
  }

  if (finished) {
    return <FinishScreen weekKey={weekKey} onRestart={restart} />;
  }

  // ---------- active card ----------

  const progress = index / total;
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to="/review"
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
        >
          ← Review
        </Link>
        <SpeedToggle />
      </div>

      <header>
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {formatWeekKey(weekKey)}
        </h1>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {index + 1} / {total}
        </p>
        <div className="mt-2">
          <ProgressBar value={progress} />
        </div>
      </header>

      <ModeToggle mode={mode} onChange={changeMode} />

      <article className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        {current && (
          <>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                한국어 뜻
              </p>
              <p className="mt-2 text-2xl font-bold leading-snug text-slate-900 dark:text-slate-100">
                {current.korean}
              </p>
              {current.type && (
                <span className="mt-3 inline-block rounded-full bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  {current.type}
                </span>
              )}
            </div>

            {!revealed && mode === 'type' && (
              <form onSubmit={onSubmitTyped} className="space-y-2">
                <input
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Type the English expression..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-base focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!typed.trim()}
                  className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  확인
                </button>
              </form>
            )}

            {!revealed && mode === 'speak' && (
              <div className="space-y-2">
                {sr.supported ? (
                  <>
                    <button
                      type="button"
                      onClick={
                        sr.transcribing
                          ? undefined
                          : sr.recording
                            ? sr.stop
                            : sr.start
                      }
                      disabled={sr.transcribing}
                      className={[
                        'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed',
                        sr.recording
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : sr.transcribing
                            ? 'bg-slate-400 text-white'
                            : 'bg-sky-600 text-white hover:bg-sky-700',
                      ].join(' ')}
                      aria-pressed={sr.recording}
                    >
                      {sr.recording ? (
                        <>
                          <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-white dark:bg-slate-800" />
                          녹음 중… 탭하면 중단
                        </>
                      ) : sr.transcribing ? (
                        <>
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          변환 중…
                        </>
                      ) : (
                        <>🎤 말하기</>
                      )}
                    </button>
                    {sr.transcript && (
                      <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          들리는 말
                        </span>
                        <br />
                        <span className="font-mono">{sr.transcript}</span>
                      </p>
                    )}
                    {sr.error && (
                      <p className="rounded-xl bg-amber-50 dark:bg-amber-900/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                        {sr.error}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={reveal}
                      disabled={sr.listening}
                      className="w-full text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 disabled:opacity-40"
                    >
                      말하지 않고 정답 보기 →
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={reveal}
                      className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
                    >
                      정답 보기
                    </button>
                    <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
                      이 브라우저는 녹음을 지원하지 않습니다.
                    </p>
                    <RecorderDiagnostics />
                  </>
                )}
              </div>
            )}

            {revealed && (
              <div className="space-y-3">
                {typedResult && (
                  <div
                    className={[
                      'space-y-1.5 rounded-xl px-3 py-2.5 text-sm',
                      typedResult === 'correct'
                        ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100'
                        : 'bg-amber-50 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      {typedResult === 'correct' ? (
                        <>
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
                            ✓
                          </span>
                          정답
                        </>
                      ) : (
                        <>
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-xs text-white">
                            ✗
                          </span>
                          오답
                        </>
                      )}
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                        내 답
                      </dt>
                      <dd className="font-mono">{typed || '(없음)'}</dd>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                        정답
                      </dt>
                      <dd className="font-mono">{current.english}</dd>
                    </dl>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    영어 표현
                  </p>
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {current.english}
                    </p>
                    <SpeakButton
                      text={current.english}
                      size="md"
                      ariaLabel="영어 표현 발음 재생"
                    />
                  </div>
                  {current.exampleFromText && (
                    <div className="mt-2 flex items-start justify-between gap-2 border-l-2 border-slate-300 dark:border-slate-600 pl-2">
                      <p className="text-xs italic text-slate-600 dark:text-slate-400">
                        “{current.exampleFromText}”
                      </p>
                      <SpeakButton
                        text={current.exampleFromText}
                        ariaLabel="예문 발음 재생"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => markAndAdvance(false)}
                    className="flex-1 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100"
                  >
                    다시
                  </button>
                  <button
                    type="button"
                    onClick={() => markAndAdvance(true)}
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    암기 완료
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </article>
    </section>
  );
}

function RecorderDiagnostics() {
  if (typeof window === 'undefined') return null;
  const items = {
    'secure context': window.isSecureContext,
    MediaRecorder: typeof MediaRecorder !== 'undefined',
    'navigator.mediaDevices': !!navigator?.mediaDevices,
    'getUserMedia()':
      typeof navigator?.mediaDevices?.getUserMedia === 'function',
  };
  return (
    <details className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-400">
      <summary className="cursor-pointer font-semibold">왜 지원 안 됨?</summary>
      <ul className="mt-1 space-y-0.5 font-mono">
        {Object.entries(items).map(([k, v]) => (
          <li key={k}>
            {v ? '✓' : '✗'} {k}:{' '}
            <span className={v ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
              {String(v)}
            </span>
          </li>
        ))}
        <li className="break-all pt-1 text-[10px] text-slate-400 dark:text-slate-500">
          UA: {navigator?.userAgent ?? '(unknown)'}
        </li>
      </ul>
    </details>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      role="group"
      aria-label="복습 모드"
      className="inline-flex w-full items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-700/60 p-1"
    >
      {(['speak', 'type'] as const).map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={active}
            className={[
              'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              active
                ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900',
            ].join(' ')}
          >
            {m === 'speak' ? '보고 말하기' : '타이핑'}
          </button>
        );
      })}
    </div>
  );
}

function FinishScreen({
  weekKey,
  onRestart,
}: {
  weekKey: string;
  onRestart: () => void;
}) {
  const summary = useMemo(
    () => listWeekSummaries().find((w) => w.weekKey === weekKey) ?? null,
    [weekKey],
  );
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to="/review"
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
        >
          ← Review
        </Link>
      </div>

      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/40 p-6 text-center">
        <p className="text-3xl">🎉</p>
        <h2 className="mt-2 text-lg font-bold text-emerald-900 dark:text-emerald-100">
          이번 복습 완료!
        </h2>
        {summary && (
          <>
            <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
              {summary.memorized} / {summary.total} 암기 완료
            </p>
            <div className="mx-auto mt-3 max-w-xs">
              <ProgressBar value={summary.rate} tone="emerald" size="md" />
            </div>
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
              {formatWeekKey(summary.weekKey)} · {Math.round(summary.rate * 100)}%
            </p>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRestart}
          className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
        >
          다시 풀기
        </button>
        <Link
          to="/review"
          className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          Review로
        </Link>
      </div>
    </section>
  );
}
