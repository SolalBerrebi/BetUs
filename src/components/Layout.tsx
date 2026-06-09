import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../lib/AppContext'

function Icon({ d, filled }: { d: string; filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[26px]" aria-hidden="true">
      <path
        d={d}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const ICONS = {
  matches:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5.2 2.6 1.9-1 3.1h-3.2l-1-3.1L12 7.2z',
  ranking: 'M4 20V10m8 10V4m8 16v-7',
  picks: 'M5 12.5l4 4L19 7',
  profile:
    'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9a8 8 0 0 1 16 0',
  admin:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.5 4-1.7-.6a7 7 0 0 0-.4-1l.8-1.6-1.4-1.4-1.6.8a7 7 0 0 0-1-.4L14.5 6h-2l-.6 1.7a7 7 0 0 0-1 .4l-1.6-.8-1.4 1.4.8 1.6a7 7 0 0 0-.4 1L6 12l1.7.6',
}

const TABS = [
  { to: '/', label: 'Matchs', icon: ICONS.matches },
  { to: '/classement', label: 'Classement', icon: ICONS.ranking },
  { to: '/pronos', label: 'Mes pronos', icon: ICONS.picks },
  { to: '/profil', label: 'Profil', icon: ICONS.profile },
]

export default function Layout() {
  const { profile } = useApp()
  const tabs = profile?.is_admin ? [...TABS, { to: '/admin', label: 'Admin', icon: ICONS.admin }] : TABS

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-28 pt-4">
      <Outlet />
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line/60 bg-white/75 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-lg">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[10px] font-medium transition-colors duration-150 ${
                  isActive ? 'text-accent' : 'text-ink-3 hover:text-ink-2'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon d={t.icon} filled={isActive} />
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
