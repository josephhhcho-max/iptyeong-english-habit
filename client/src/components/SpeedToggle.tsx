import { PLAYBACK_RATES, usePlaybackRate, type PlaybackRate } from '../lib/usePlaybackRate';

export default function SpeedToggle() {
  const { rate, setRate } = usePlaybackRate();

  return (
    <div
      role="group"
      aria-label="재생 속도"
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700/60 p-1"
    >
      {PLAYBACK_RATES.map((r: PlaybackRate) => {
        const active = r === rate;
        return (
          <button
            key={r}
            type="button"
            onClick={() => setRate(r)}
            aria-pressed={active}
            className={[
              'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
              active
                ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900',
            ].join(' ')}
          >
            {r === 1.0 ? '1.0x' : `${r}x`}
          </button>
        );
      })}
    </div>
  );
}
