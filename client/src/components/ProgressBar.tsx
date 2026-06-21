type Props = {
  value: number; // 0..1
  size?: 'sm' | 'md';
  tone?: 'sky' | 'emerald';
};

const HEIGHT: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-1.5',
  md: 'h-2',
};

const FILL: Record<NonNullable<Props['tone']>, string> = {
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
};

export default function ProgressBar({ value, size = 'sm', tone = 'sky' }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60 ${HEIGHT[size]}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out ${FILL[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
