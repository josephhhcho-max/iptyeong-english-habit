import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SpeakButton from '../components/SpeakButton';
import SpeedToggle from '../components/SpeedToggle';
import { sendConversation } from '../lib/api';
import {
  appendConversation,
  clearConversation,
  getConversation,
  listExpressions,
  listSessions,
  newId,
  setConversation,
} from '../lib/store';
import { useWhisperRecorder } from '../lib/useWhisperRecorder';
import type { ChatMessage } from '../types';

export default function Conversation() {
  const sessions = useMemo(() => {
    const all = listSessions();
    return [...all].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, []);

  const [sessionId, setSessionId] = useState<string>(() => sessions[0]?.id ?? '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const recorder = useWhisperRecorder();
  // Track which transcript we've already merged into `input` so a stable
  // transcript doesn't keep re-appending on every render.
  const consumedTranscriptRef = useRef('');

  // When session changes, load its persisted history.
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    setMessages(getConversation(sessionId));
    setInput('');
    setError(null);
  }, [sessionId]);

  // Auto-scroll on new message or while loading (so spinner is visible).
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  // When the recorder finishes transcribing, merge the transcript into the
  // textarea so the user can review/edit before tapping 보내기.
  useEffect(() => {
    if (recorder.recording || recorder.transcribing) return;
    const trimmed = recorder.transcript.trim();
    if (!trimmed) return;
    if (consumedTranscriptRef.current === trimmed) return;
    consumedTranscriptRef.current = trimmed;
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${trimmed}` : trimmed));
  }, [recorder.recording, recorder.transcribing, recorder.transcript]);

  // Reset the consumed-marker whenever the session changes so the next session
  // doesn't carry over the previous session's last transcript.
  useEffect(() => {
    consumedTranscriptRef.current = '';
    recorder.reset();
    // recorder.reset is stable enough — we only care about session swaps here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (sessions.length === 0) {
    return (
      <section className="space-y-3">
        <header>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Conversation</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            오늘의 주제로 영어 회화 연습.
          </p>
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

  const session = sessions.find((s) => s.id === sessionId) ?? sessions[0];
  const expressions = listExpressions(session.id);

  async function sendOpener() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const response = await sendConversation({
        topic: session.topic,
        expressions: expressions.map((e) => ({
          english: e.english,
          korean: e.korean,
        })),
        history: [],
      });
      const assistantMsg = makeAssistantMessage(
        response.reply,
        response.nextQuestion,
        response.paraphrases,
      );
      const next = appendConversation(session.id, assistantMsg);
      setMessages(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!session) return;
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    // Append user message immediately for snappy UX.
    const optimistic = appendConversation(session.id, userMsg);
    setMessages(optimistic);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await sendConversation({
        topic: session.topic,
        expressions: expressions.map((e) => ({
          english: e.english,
          korean: e.korean,
        })),
        history: optimistic.map((m) => ({ role: m.role, content: m.content })),
      });
      const assistantMsg = makeAssistantMessage(
        response.reply,
        response.nextQuestion,
        response.paraphrases,
      );
      const next = appendConversation(session.id, assistantMsg);
      setMessages(next);
    } catch (err) {
      // Roll back the optimistic user message so we don't leave the history
      // in a "two consecutive user turns" state that the next call would
      // reject. Restore the input text so the user can retry without retyping.
      const rolled = optimistic.slice(0, -1);
      setConversation(session.id, rolled);
      setMessages(rolled);
      setInput(text);
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    if (!session) return;
    if (!window.confirm('이 세션의 대화 기록을 모두 지울까요?')) return;
    clearConversation(session.id);
    setMessages([]);
    setError(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    // h = viewport - main pt-6 (1.5rem) - main pb-24 (6rem) = 7.5rem. dvh
    // shrinks when the mobile keyboard opens, so the input stays in view.
    <section className="flex h-[calc(100dvh-7.5rem)] flex-col">
      <header className="shrink-0 space-y-2 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Conversation</h1>
          <SpeedToggle />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex-1">
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
          {messages.length > 0 && (
            <button
              type="button"
              onClick={resetChat}
              className="rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              초기화
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          주제: <span className="font-medium text-slate-700 dark:text-slate-300">{session.topic}</span> ·{' '}
          핵심 표현 {expressions.length}개
        </p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
        {messages.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              이 주제로 처음 대화를 시작해보세요.
            </p>
            <button
              type="button"
              onClick={sendOpener}
              disabled={loading}
              className="mt-3 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              대화 시작하기 →
            </button>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}

        {loading && <TypingIndicator />}
        {error && (
          <p className="rounded-xl bg-red-50 dark:bg-red-900/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <div ref={scrollEndRef} aria-hidden="true" />
      </div>

      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pt-2">
        {recorder.error && (
          <p className="mb-1 rounded-lg bg-amber-50 dark:bg-amber-900/40 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-200">
            {recorder.error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={
              recorder.recording
                ? '듣고 있어요…'
                : recorder.transcribing
                  ? '변환 중…'
                  : '영어로 답해보세요…'
            }
            disabled={loading || recorder.recording || recorder.transcribing}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
          />
          {recorder.supported && (
            <button
              type="button"
              onClick={
                recorder.transcribing
                  ? undefined
                  : recorder.recording
                    ? recorder.stop
                    : recorder.start
              }
              disabled={loading || recorder.transcribing}
              aria-label={
                recorder.recording
                  ? '녹음 중단'
                  : recorder.transcribing
                    ? '변환 중'
                    : '음성으로 답하기'
              }
              aria-pressed={recorder.recording}
              className={[
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-colors disabled:cursor-not-allowed',
                recorder.recording
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : recorder.transcribing
                    ? 'bg-slate-300 text-white'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-sky-100 hover:text-sky-700',
              ].join(' ')}
            >
              {recorder.recording ? (
                <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-white dark:bg-slate-800" />
              ) : recorder.transcribing ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span aria-hidden="true">🎤</span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={send}
            disabled={loading || recorder.recording || recorder.transcribing || !input.trim()}
            className="shrink-0 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            보내기
          </button>
        </div>
      </div>
    </section>
  );
}

function makeAssistantMessage(
  reply: string,
  nextQuestion: string,
  paraphrases?: string[],
): ChatMessage {
  const content = [reply, nextQuestion].filter((s) => s && s.trim()).join('\n\n');
  return {
    id: newId(),
    role: 'assistant',
    content,
    reply: reply ?? '',
    paraphrases: paraphrases?.filter((p) => p && p.trim()) ?? [],
    nextQuestion: nextQuestion ?? '',
    createdAt: new Date().toISOString(),
  };
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-sky-600 px-3.5 py-2 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant — render reply, optional paraphrases card, then nextQuestion.
  const reply = message.reply ?? '';
  const paraphrases = message.paraphrases ?? [];
  const nextQuestion = message.nextQuestion ?? '';
  return (
    <div className="flex flex-col items-start gap-1.5">
      {reply && (
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-slate-100 dark:bg-slate-700/60 px-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 shadow-sm">
          {reply}
        </div>
      )}
      {paraphrases.length > 0 && (
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-amber-50 dark:bg-amber-900/40 px-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 shadow-sm ring-1 ring-amber-200">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            같은 의미 다른 표현
          </p>
          <ul className="space-y-1.5">
            {paraphrases.map((p, i) => (
              <li key={`${i}-${p.slice(0, 12)}`} className="flex items-start gap-2">
                <SpeakButton text={p} ariaLabel="다른 표현 발음 재생" />
                <span className="flex-1 text-sm italic">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {nextQuestion && (
        <div className="flex max-w-[85%] items-start gap-2 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-slate-200">
          <p className="flex-1 font-medium">{nextQuestion}</p>
          <SpeakButton text={nextQuestion} ariaLabel="질문 발음 재생" />
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3.5 py-2 text-slate-400 dark:text-slate-500">
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
    </div>
  );
}
