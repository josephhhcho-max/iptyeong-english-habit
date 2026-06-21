import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/today', label: 'Today', icon: '📷' },
  { to: '/conversation', label: 'Talk', icon: '💬' },
  { to: '/writing', label: 'Write', icon: '✍️' },
  { to: '/review', label: 'Review', icon: '🔁' },
  { to: '/saved', label: '갈무리', icon: '★' },
  { to: '/history', label: '기록', icon: '📅' },
] as const;

export default function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="grid grid-cols-7">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] transition-colors',
                  isActive
                    ? 'font-semibold text-sky-600 dark:text-sky-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                ].join(' ')
              }
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
