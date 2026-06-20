import { useEffect, useReducer } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { newStatsCount, STATS_SEEN_EVENT } from '../lib/statsBadge'
import { Powered } from './ui'

/* Icônes façon SF Symbols — stroke 1.7, remplissage partiel à l'état actif */

function BallIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[24px]" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.6" />
      <path
        d="M12 8.1l3.2 2.33-1.22 3.76h-3.96L8.8 10.43z"
        fill={active ? 'currentColor' : 'none'}
      />
      <path d="M12 8.1V3.5M15.2 10.4l4.3-1.4M13.98 14.2l2.7 3.7M10.02 14.2l-2.7 3.7M8.8 10.4L4.5 9" />
    </svg>
  )
}

function TrophyIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[24px]" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" fill={active ? 'currentColor' : 'none'} />
      <path d="M7.5 5.5H5.1a.6.6 0 0 0-.6.6C4.5 8.2 5.9 9.8 7.8 10M16.5 5.5h2.4a.6.6 0 0 1 .6.6c0 2.1-1.4 3.7-3.3 3.9" />
      <path d="M12 13.5v2.7" />
      <path d="M9.2 19.5c.3-1.9 1.5-3.3 2.8-3.3s2.5 1.4 2.8 3.3z" fill={active ? 'currentColor' : 'none'} />
      <path d="M7.8 19.5h8.4" />
    </svg>
  )
}

function ChecklistIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[24px]" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 6.5h9M4.5 12h9M4.5 17.5h5.5" />
      <path d="M14.5 16.2l2.2 2.3 4.3-4.8" strokeWidth={active ? 2.4 : 1.7} />
    </svg>
  )
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[24px]" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.8" fill={active ? 'currentColor' : 'none'} />
      <path
        d="M4.8 20.2c.9-3.4 3.8-5.4 7.2-5.4s6.3 2 7.2 5.4"
        fill={active ? 'currentColor' : 'none'}
      />
    </svg>
  )
}

function SlidersIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[24px]" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7.5h8.3M17.3 7.5H20" />
      <circle cx="15" cy="7.5" r="2.3" fill={active ? 'currentColor' : 'none'} />
      <path d="M4 16.5h2.3M11.3 16.5H20" />
      <circle cx="9" cy="16.5" r="2.3" fill={active ? 'currentColor' : 'none'} />
    </svg>
  )
}

const TABS = [
  { to: '/', label: 'Matchs', Icon: BallIcon },
  { to: '/classement', label: 'Classement', Icon: TrophyIcon },
  { to: '/pronos', label: 'Mes pronos', Icon: ChecklistIcon },
  { to: '/profil', label: 'Profil', Icon: PersonIcon },
]

export default function Layout() {
  const { profile, matches, myPredictions } = useApp()
  const tabs = profile?.is_admin ? [...TABS, { to: '/admin', label: 'Admin', Icon: SlidersIcon }] : TABS

  // Pastille « stats à voir » sur l'onglet Profil — se rafraîchit quand le joueur
  // a consulté ses stats (événement) ou quand un nouveau résultat tombe (contexte).
  const [, bump] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    window.addEventListener(STATS_SEEN_EVENT, bump)
    return () => window.removeEventListener(STATS_SEEN_EVENT, bump)
  }, [])
  const profileDot = newStatsCount(matches, myPredictions) > 0

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-36 pt-4">
      <Outlet />
      <Powered />
      <nav
        className="fixed inset-x-0 bottom-0 z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="tabbar mx-auto max-w-lg px-4 pb-2.5">
          <div className="liquid-glass flex rounded-[26px] p-1.5">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-1.5 text-[10px] font-semibold
                   transition-all duration-200 active:scale-95 ${
                     isActive ? 'bg-white/75 text-accent shadow-(--shadow-card)' : 'text-ink-2/80 hover:text-ink'
                   }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <t.Icon active={isActive} />
                      {t.to === '/profil' && profileDot && (
                        <span className="absolute -right-1.5 -top-0.5 size-2 rounded-full bg-negative ring-2 ring-white" />
                      )}
                    </span>
                    {t.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}
