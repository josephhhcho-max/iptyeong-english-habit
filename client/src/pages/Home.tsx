import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import { API_BASE, apiFetch } from '../lib/api';
import {
  downloadBackup,
  exportAll,
  importAll,
  readBundleFromFile,
} from '../lib/backup';
import {
  calculateStreak,
  currentWeekSummary,
  hasSessionToday,
  overallStats,
} from '../lib/review';
import { THEMES, useTheme, type Theme } from '../lib/useTheme';
import { isoWeekKey } from '../lib/week';

type HealthResponse = {
  status: string;
  hasApiKey?: boolean;
};

function formatWeekKey(weekKey: string): string {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return weekKey;
  return `${m[1]}년 ${parseInt(m[2], 10)}주차`;
}

export default function Home() {
  // Recompute on every mount so stats reflect the latest store state.
  const week = useMemo(() => currentWeekSummary(), []);
  const overall = useMemo(() => overallStats(), []);
  const streak = useMemo(() => calculateStreak(), []);
  const todayDone = useMemo(() => hasSessionToday(), []);
  const thisWeekKey = isoWeekKey();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<HealthResponse>('/api/health')
      .then(setHealth)
      .catch((err: unknown) => {
        setHealthError(err instanceof Error ? err.message : 'unknown error');
      });
  }, []);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          입트영 English Habit
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          매일 짧게, 꾸준히.
        </p>
      </header>

      {/* Today CTA */}
      <Link
        to={todayDone ? '/today' : '/today'}
        className="block rounded-2xl bg-sky-600 p-4 text-white shadow-sm transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
              {todayDone ? '오늘 학습 완료' : '오늘 학습 시작'}
            </p>
            <p className="mt-0.5 text-lg font-bold">
              {todayDone ? '오늘 카드 다시 보기' : '교재 사진 올리기'}
            </p>
          </div>
          <span className="text-2xl">{todayDone ? '✓' : '→'}</span>
        </div>
      </Link>

      {/* Streak + this week */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="연속 학습"
          value={
            <span className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{streak}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">일</span>
            </span>
          }
          accent={streak > 0 ? '🔥' : '·'}
        />
        <StatCard
          label="이번 주 암기율"
          value={
            <span className="text-2xl font-bold">
              {week ? `${Math.round(week.rate * 100)}%` : '—'}
            </span>
          }
          accent={week ? formatWeekKey(thisWeekKey) : null}
        />
      </div>

      {week && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
              {formatWeekKey(thisWeekKey)} 진행
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {week.memorized} / {week.total} · {week.sessionCount}회 세션
            </p>
          </div>
          <div className="mt-2">
            <ProgressBar
              value={week.rate}
              size="md"
              tone={week.rate >= 1 ? 'emerald' : 'sky'}
            />
          </div>
          <Link
            to={`/review/${week.weekKey}`}
            className="mt-3 block rounded-xl bg-sky-100 px-4 py-2 text-center text-sm font-semibold text-sky-700 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-200 dark:hover:bg-sky-900"
          >
            이번 주 복습하기 →
          </Link>
        </div>
      )}

      {/* Totals */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          전체 누적
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Stat label="세션" value={overall.sessionCount} />
          <Stat label="표현" value={overall.expressionCount} />
          <Stat label="암기" value={`${overall.memorizedCount}`} />
          <Stat label="내 문장" value={overall.myExamplesCount} />
          <Stat label="영작" value={overall.writingCount} />
          <Stat label="★ 갈무리" value={overall.bookmarkedCount} />
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <QuickLink
          to="/saved"
          icon="★"
          label="갈무리"
          sub={`${overall.bookmarkedCount}개 표현`}
        />
        <QuickLink
          to="/history"
          icon="📅"
          label="기록"
          sub="날짜별로 보기"
        />
      </div>

      {/* Settings */}
      <SettingsSection />

      {/* Health footer */}
      <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
        <div className="flex items-center justify-between gap-2">
          <span>
            서버:{' '}
            {health ? (
              <span className="text-emerald-700 dark:text-emerald-400">ok</span>
            ) : healthError ? (
              <span className="text-red-600 dark:text-red-400">오프라인</span>
            ) : (
              <span className="text-slate-400">확인 중…</span>
            )}
            {health?.hasApiKey === false && ' · API 키 미설정'}
          </span>
          <span className="text-slate-400 dark:text-slate-500">
            {API_BASE || 'local'}
          </span>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-700/40">
      <p className="text-base font-bold text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2 text-slate-900 dark:text-slate-100">
        {value}
        {accent != null && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {accent}
          </span>
        )}
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  label,
  sub,
}: {
  to: string;
  icon: string;
  label: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50/40 active:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-700 dark:hover:bg-sky-900/30"
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {label}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>
      </div>
    </Link>
  );
}

function SettingsSection() {
  const { theme, setTheme } = useTheme();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function onExport() {
    setBusy('export');
    setError(null);
    setMessage(null);
    try {
      const bundle = await exportAll();
      downloadBackup(bundle);
      setMessage('백업 파일을 다운로드했습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setBusy(null);
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy('import');
    setError(null);
    setMessage(null);
    try {
      const bundle = await readBundleFromFile(file);
      const confirmed = window.confirm(
        '백업을 가져오면 기존 데이터가 덮어써집니다. 계속할까요?',
      );
      if (!confirmed) {
        setBusy(null);
        return;
      }
      const stats = await importAll(bundle, { merge: false });
      setMessage(
        `세션 ${stats.sessions}, 표현 ${stats.expressions}, 영작 ${stats.writings}, 이미지 ${stats.images}개 복원됨. 새로고침해주세요.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
        설정
      </summary>

      <div className="mt-3 space-y-4">
        {/* Theme */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            테마
          </p>
          <div
            role="group"
            aria-label="테마"
            className="mt-2 inline-flex w-full items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-700/40"
          >
            {THEMES.map((t) => (
              <ThemeButton
                key={t}
                value={t}
                active={theme === t}
                onClick={() => setTheme(t)}
              />
            ))}
          </div>
        </div>

        {/* Backup */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            백업
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={busy === 'export'}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {busy === 'export' ? '내보내는 중…' : '내보내기 (JSON)'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy === 'import'}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {busy === 'import' ? '복원 중…' : '가져오기'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={onImportFile}
              className="hidden"
            />
          </div>
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
            세션·표현·대화·영작·사진까지 전부 포함됩니다. 다른 기기로 옮길 때 사용하세요.
          </p>
        </div>

        {message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:bg-red-900/40 dark:text-red-200">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}

function ThemeButton({
  value,
  active,
  onClick,
}: {
  value: Theme;
  active: boolean;
  onClick: () => void;
}) {
  const label = value === 'light' ? '☀ 밝게' : value === 'dark' ? '🌙 어둡게' : '⚙ 시스템';
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
      {label}
    </button>
  );
}
