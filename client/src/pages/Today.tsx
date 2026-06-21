import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractExpressions } from '../lib/api';
import { prepareImageForUpload } from '../lib/image';
import {
  getImage,
  getLatestSession,
  listExpressions,
  newId,
  saveExpressions,
  saveImage,
  saveSession,
} from '../lib/store';
import type { Expression, Session } from '../types';
import { isoWeekKey } from '../lib/week';
import SpeakButton from '../components/SpeakButton';
import SpeedToggle from '../components/SpeedToggle';

type ViewState = {
  session: Session;
  expressions: Expression[];
  previewUrl: string;
};

export default function Today() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Restore most recent session on mount.
  useEffect(() => {
    let revokeUrl: string | null = null;
    (async () => {
      const latest = getLatestSession();
      if (!latest) return;
      const blob = await getImage(latest.imageId);
      if (!blob) {
        setView({
          session: latest,
          expressions: listExpressions(latest.id),
          previewUrl: '',
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      revokeUrl = url;
      setView({
        session: latest,
        expressions: listExpressions(latest.id),
        previewUrl: url,
      });
    })().catch(() => {});

    return () => {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, []);

  // Revoke transient preview URLs when the chosen file changes.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setError(null);
    setView(null);
    setFile(picked);
    setPreviewUrl(picked ? URL.createObjectURL(picked) : null);
  }

  function resetUpload() {
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onExtract() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setProgress('이미지 준비 중…');
    try {
      const prepared = await prepareImageForUpload(file);
      setProgress('Claude에게 표현 추출 요청 중…');
      const result = await extractExpressions({
        imageBase64: prepared.base64,
        mediaType: prepared.mediaType,
      });

      if (!result || !Array.isArray(result.expressions)) {
        throw new Error('서버 응답이 예상한 형식이 아닙니다.');
      }

      setProgress('저장 중…');
      const now = new Date();
      const sessionId = newId();
      const imageId = `img-${sessionId}`;
      await saveImage(imageId, prepared.blob);

      const expressions: Expression[] = result.expressions.map((e) => ({
        id: newId(),
        sessionId,
        english: e.english ?? '',
        korean: e.korean ?? '',
        type: e.type ?? 'vocabulary',
        exampleFromText: e.exampleFromText ?? '',
        createdAt: now.toISOString(),
      }));

      const session: Session = {
        id: sessionId,
        createdAt: now.toISOString(),
        weekKey: isoWeekKey(now),
        topic: result.topic ?? '제목 없음',
        imageId,
        imageMediaType: prepared.mediaType,
        expressionIds: expressions.map((e) => e.id),
      };

      saveSession(session);
      saveExpressions(expressions);

      const restoredUrl = URL.createObjectURL(prepared.blob);
      setView({ session, expressions, previewUrl: restoredUrl });
      setFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoading(false);
      setProgress('');
    }
  }

  const showResult = view && !file;

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Today</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          교재 페이지를 찍어 핵심 표현을 뽑아보세요.
        </p>
      </header>

      <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        {previewUrl ? (
          <div className="space-y-3">
            <img
              src={previewUrl}
              alt="업로드한 교재 이미지"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 object-contain"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onExtract}
                disabled={loading}
                className="flex-1 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? '추출 중…' : '표현 추출하기'}
              </button>
              <button
                type="button"
                onClick={resetUpload}
                disabled={loading}
                className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 px-4 py-10 text-center hover:border-sky-400 hover:bg-sky-50">
            <span className="text-3xl">📷</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              사진 찍기 또는 파일 선택
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              교재 한 페이지가 잘 보이게 찍어주세요
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onPick}
            />
          </label>
        )}

        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-xl bg-sky-50 dark:bg-sky-900/40 px-3 py-2 text-sm text-sky-800 dark:text-sky-200"
          >
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
            <span>{progress || '처리 중…'}</span>
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 dark:bg-red-900/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>

      {showResult && (
        <ResultBlock
          view={view}
          onNewUpload={() => {
            setView(null);
            resetUpload();
          }}
        />
      )}
    </section>
  );
}

function ResultBlock({
  view,
  onNewUpload,
}: {
  view: ViewState;
  onNewUpload: () => void;
}) {
  const { session, expressions, previewUrl } = view;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
            {session.topic}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {new Date(session.createdAt).toLocaleString()} · {session.weekKey} ·{' '}
            {expressions.length}개 표현
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SpeedToggle />
          <button
            type="button"
            onClick={onNewUpload}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
          >
            새 사진
          </button>
        </div>
      </div>

      {previewUrl && (
        <img
          src={previewUrl}
          alt="추출 대상 이미지"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 object-contain"
        />
      )}

      {expressions.length === 0 ? (
        <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
          추출된 표현이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {expressions.map((e) => (
            <li key={e.id}>
              <Link
                to={`/expression/${e.id}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50/40 active:bg-sky-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {e.english}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <SpeakButton text={e.english} ariaLabel="영어 표현 발음 재생" />
                    <span className="rounded-full bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
                      {e.type}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{e.korean}</p>
                {e.exampleFromText && (
                  <p className="mt-2 border-l-2 border-slate-200 dark:border-slate-700 pl-2 text-xs italic text-slate-500 dark:text-slate-400">
                    {e.exampleFromText}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
