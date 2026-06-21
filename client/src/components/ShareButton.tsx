import { useState } from 'react';

type Props = {
  /** Title hint for the OS share sheet (apps may ignore). */
  title?: string;
  /** Main body text — the actual content to share. */
  text: string;
  /** Optional URL passed alongside the text. */
  url?: string;
  /** Visual size of the icon button. */
  size?: 'sm' | 'md';
  /** Accessible label. */
  ariaLabel?: string;
};

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
};

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export default function ShareButton({
  title,
  text,
  url,
  size = 'sm',
  ariaLabel = '공유',
}: Props) {
  const [flash, setFlash] = useState<string | null>(null);

  async function onShare(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!text.trim()) return;

    const payload: { title?: string; text: string; url?: string } = { text };
    if (title) payload.title = title;
    if (url) payload.url = url;

    // 1) Prefer native share sheet (Kakao, Notion, Mail, etc. all show up).
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        if (isAbort(err)) return; // user closed the sheet
        // any other error → fall through to clipboard
      }
    }

    // 2) Clipboard fallback.
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      const combined = url ? `${text}\n\n${url}` : text;
      try {
        await navigator.clipboard.writeText(combined);
        setFlash('클립보드에 복사됨');
      } catch {
        setFlash('복사 실패');
      }
      window.setTimeout(() => setFlash(null), 2000);
      return;
    }

    setFlash('공유 미지원');
    window.setTimeout(() => setFlash(null), 2000);
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onShare}
        aria-label={ariaLabel}
        className={[
          'inline-flex shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 transition-colors hover:bg-sky-100 dark:hover:bg-sky-900/40 hover:text-sky-700 dark:hover:text-sky-300',
          SIZE[size],
        ].join(' ')}
      >
        <span aria-hidden="true">↗</span>
      </button>
      {flash && (
        <span
          role="status"
          className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white shadow dark:bg-slate-700"
        >
          {flash}
        </span>
      )}
    </span>
  );
}
