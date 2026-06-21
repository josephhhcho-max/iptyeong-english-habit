import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ShareButton from '../components/ShareButton';
import SpeakButton from '../components/SpeakButton';
import SpeedToggle from '../components/SpeedToggle';
import { getWritingFeedback, getWritingPrompt } from '../lib/api';
import { buildWritingShareText } from '../lib/share';
import {
  listExpressions,
  listSessions,
  listWritings,
  newId,
  saveWriting,
} from '../lib/store';
import type { Session, WritingFeedback, WritingPiece } from '../types';

type Stage =
  | { kind: 'no-prompt' }
  | { kind: 'drafting'; prompt: string }
  | {
      kind: 'feedback';
      prompt: string;
      userText: string;
      feedback: WritingFeedback;
      savedAs: string | null;
    };

export default function Writing() {
  const sessions = useMemo(() => {
    const all = listSessions();
    return [...all].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, []);

  const [sessionId, setSessionId] = useState<string>(() => sessions[0]?.id ?? '');
  const session: Session | undefined = sessions.find((s) => s.id === sessionId) ?? sessions[0];
  const expressions = session ? listExpressions(session.id) : [];

  const [stage, setStage] = useState<Stage>({ kind: 'no-prompt' });
  const [userText, setUserText] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<WritingPiece[]>(() =>
    session ? listWritings(session.id) : [],
  );

  // Reset workspace when session changes.
  useEffect(() => {
    setStage({ kind: 'no-prompt' });
    setUserText('');
    setError(null);
    setPast(session ? listWritings(session.id) : []);
  }, [sessionId, session]);

  if (sessions.length === 0 || !session) {
    return (
      <section className="space-y-3">
        <header>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Writing</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">오늘의 주제로 영작을 써보세요.</p>
        </header>
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            먼저 Today에서 사진을 올려 표현을 추출해주세요.
          </p>
          <Link
            to="/today"
            className="mt-3 inline-block rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Today로 가기 →
          </Link>
        </div>
      </section>
    );
  }

  async function loadPrompt() {
    if (!session) return;
    setLoadingPrompt(true);
    setError(null);
    try {
      const res = await getWritingPrompt({
        topic: session.topic,
        expressions: expressions.map((e) => ({
          english: e.english,
          korean: e.korean,
        })),
      });
      if (!res.prompt) throw new Error('과제를 받지 못했습니다.');
      setStage({ kind: 'drafting', prompt: res.prompt });
      setUserText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function submitFeedback() {
    if (stage.kind !== 'drafting' || !session) return;
    const text = userText.trim();
    if (!text) return;
    setLoadingFeedback(true);
    setError(null);
    try {
      const feedback = await getWritingFeedback({
        topic: session.topic,
        prompt: stage.prompt,
        userText: text,
      });
      setStage({
        kind: 'feedback',
        prompt: stage.prompt,
        userText: text,
        feedback,
        savedAs: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoadingFeedback(false);
    }
  }

  function savePiece() {
    if (stage.kind !== 'feedback' || !session) return;
    const piece: WritingPiece = {
      id: newId(),
      sessionId: session.id,
      topic: session.topic,
      prompt: stage.prompt,
      userText: stage.userText,
      feedback: stage.feedback,
      createdAt: new Date().toISOString(),
    };
    saveWriting(piece);
    setPast(listWritings(session.id));
    setStage({ ...stage, savedAs: piece.id });
  }

  function startNew() {
    setStage({ kind: 'no-prompt' });
    setUserText('');
    setError(null);
  }

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Writing</h1>
          <SpeedToggle />
        </div>
        <label className="block">
          <span className="sr-only">세션 선택</span>
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.topic} · {new Date(s.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          주제: <span className="font-medium text-slate-700 dark:text-slate-300">{session.topic}</span> ·{' '}
          핵심 표현 {expressions.length}개
        </p>
      </header>

      {stage.kind === 'no-prompt' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            이번 주제로 짧은 영작을 연습해볼까요?
          </p>
          <button
            type="button"
            onClick={loadPrompt}
            disabled={loadingPrompt}
            className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loadingPrompt ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                과제 만드는 중…
              </span>
            ) : (
              '영작 과제 받기 →'
            )}
          </button>
        </div>
      )}

      {stage.kind === 'drafting' && (
        <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/40 px-3 py-2.5 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              오늘의 과제
            </p>
            <p className="mt-1">{stage.prompt}</p>
          </div>
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            rows={6}
            placeholder="3~5문장으로 영어로 작성해보세요…"
            disabled={loadingFeedback}
            className="w-full resize-y rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startNew}
              disabled={loadingFeedback}
              className="rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              새 과제
            </button>
            <button
              type="button"
              onClick={submitFeedback}
              disabled={loadingFeedback || !userText.trim()}
              className="flex-1 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loadingFeedback ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  첨삭 받는 중…
                </span>
              ) : (
                '첨삭 받기'
              )}
            </button>
          </div>
        </div>
      )}

      {stage.kind === 'feedback' && (
        <FeedbackBlock
          stage={stage}
          topic={session.topic}
          onSave={savePiece}
          onNew={startNew}
        />
      )}

      {error && (
        <p className="rounded-xl bg-red-50 dark:bg-red-900/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}

      {past.length > 0 && (
        <PastWritingsList items={past} />
      )}
    </section>
  );
}

function FeedbackBlock({
  stage,
  topic,
  onSave,
  onNew,
}: {
  stage: Extract<Stage, { kind: 'feedback' }>;
  topic: string;
  onSave: () => void;
  onNew: () => void;
}) {
  const { prompt, userText, feedback, savedAs } = stage;
  const sharePiece: WritingPiece = {
    id: 'pending',
    sessionId: '',
    topic,
    prompt,
    userText,
    feedback,
    createdAt: new Date().toISOString(),
  };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            내가 쓴 글
          </p>
          <ShareButton
            title={`영작 — ${topic}`}
            text={buildWritingShareText(sharePiece)}
            ariaLabel="전체 영작 공유"
          />
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{userText}</p>
        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">과제: {prompt}</p>
      </div>

      {feedback.corrections.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            교정 사항 ({feedback.corrections.length})
          </p>
          <ul className="mt-2 space-y-3">
            {feedback.corrections.map((c, i) => (
              <li key={i} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                    원문
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{c.original}</p>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    교정
                  </p>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.fixed}</p>
                    <SpeakButton text={c.fixed} ariaLabel="교정문 발음 재생" />
                  </div>
                </div>
                {c.why && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      이유
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{c.why}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/40 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          🎉 교정이 필요한 부분이 없어요. 잘 썼어요!
        </div>
      )}

      {feedback.overall && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            총평
          </p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{feedback.overall}</p>
        </div>
      )}

      {feedback.modelAnswer && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              모범 답안
            </p>
            <SpeakButton
              text={feedback.modelAnswer}
              size="md"
              ariaLabel="모범 답안 발음 재생"
            />
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {feedback.modelAnswer}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {savedAs ? (
          <span className="flex-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 px-4 py-2.5 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            ✓ 저장됨
          </span>
        ) : (
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            이 영작 저장
          </button>
        )}
        <button
          type="button"
          onClick={onNew}
          className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
        >
          새 과제
        </button>
      </div>
    </div>
  );
}

function PastWritingsList({ items }: { items: WritingPiece[] }) {
  return (
    <details className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">
        과거 영작 ({items.length})
      </summary>
      <ul className="mt-3 space-y-2">
        {items.map((w) => (
          <PastWritingCard key={w.id} piece={w} />
        ))}
      </ul>
    </details>
  );
}

function PastWritingCard({ piece }: { piece: WritingPiece }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="block flex-1 text-left"
        >
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {new Date(piece.createdAt).toLocaleString()}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{piece.prompt}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-800 dark:text-slate-200">{piece.userText}</p>
        </button>
        <ShareButton
          title={`영작 — ${piece.topic}`}
          text={buildWritingShareText(piece)}
          ariaLabel="이 영작 공유"
        />
      </div>
      {expanded && piece.feedback && (
        <div className="mt-3 space-y-2 border-t border-slate-200 dark:border-slate-700 pt-3">
          {piece.feedback.corrections.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                교정 ({piece.feedback.corrections.length})
              </p>
              <ul className="mt-1 space-y-2">
                {piece.feedback.corrections.map((c, i) => (
                  <li key={i} className="text-xs">
                    <p className="text-rose-700 dark:text-rose-300">{c.original}</p>
                    <p className="flex items-start justify-between gap-2 text-emerald-700 dark:text-emerald-300">
                      <span>→ {c.fixed}</span>
                      <SpeakButton text={c.fixed} ariaLabel="교정문 발음 재생" />
                    </p>
                    {c.why && <p className="mt-0.5 text-slate-500 dark:text-slate-400">{c.why}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {piece.feedback.overall && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                총평
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{piece.feedback.overall}</p>
            </div>
          )}
          {piece.feedback.modelAnswer && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  모범 답안
                </p>
                <SpeakButton
                  text={piece.feedback.modelAnswer}
                  ariaLabel="모범 답안 발음 재생"
                />
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">
                {piece.feedback.modelAnswer}
              </p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
