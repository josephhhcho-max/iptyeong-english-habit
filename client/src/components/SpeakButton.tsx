import { useEffect, useRef, useState } from 'react';
import { cancelSpeak, isTTSSupported, speak } from '../lib/tts';
import { usePlaybackRate } from '../lib/usePlaybackRate';

type Props = {
  text: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  /** Override the global playback rate. */
  rate?: number;
};

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
};

export default function SpeakButton({ text, size = 'sm', ariaLabel, rate: override }: Props) {
  const { rate } = usePlaybackRate();
  const [playing, setPlaying] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!isTTSSupported() || !text.trim()) return null;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Stop the click from propagating to wrapping links/buttons.
    e.preventDefault();
    e.stopPropagation();

    if (playing) {
      cancelSpeak();
      setPlaying(false);
      return;
    }

    setPlaying(true);
    try {
      await speak(text, override ?? rate);
    } catch (err) {
      console.warn('[speak] failed:', err);
    } finally {
      if (mountedRef.current) setPlaying(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel ?? `발음 재생: ${text}`}
      aria-pressed={playing}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors',
        playing
          ? 'bg-sky-600 text-white hover:bg-sky-700'
          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-sky-100 hover:text-sky-700',
        SIZE_CLASSES[size],
      ].join(' ')}
    >
      <span aria-hidden="true">{playing ? '⏹' : '▶'}</span>
    </button>
  );
}
