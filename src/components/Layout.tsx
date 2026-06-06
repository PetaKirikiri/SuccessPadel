import type React from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Profile } from '../pages/Profile'

type NavIconProps = { className?: string }

function IconFun({ className }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="var(--color-brand-fun)" />
      <circle cx="8.75" cy="10" r="1.35" fill="#fff" />
      <circle cx="15.25" cy="10" r="1.35" fill="#fff" />
      <path
        d="M8.25 14.25c1.1 1.65 2.35 2.5 3.75 2.5s2.65-.85 3.75-2.5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconRank({ className }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3l2.2 4.5 5 .7-3.6 3.5.85 5L12 14.8 7.55 16.7l.85-5L4.8 8.2l5-.7L12 3z"
        fill="currentColor"
        opacity="0.28"
      />
      <path
        d="M12 3l2.2 4.5 5 .7-3.6 3.5.85 5L12 14.8 7.55 16.7l.85-5L4.8 8.2l5-.7L12 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5 19.5h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8 19.5V16.8M12 19.5V15.2M16 19.5V17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconCompetition({ className }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M7 4h10v2.8a5 5 0 0 1-10 0V4z"
        fill="currentColor"
        opacity="0.28"
      />
      <path
        d="M7 4h10v2.8a5 5 0 0 1-10 0V4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 11.5V14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M9.25 14h5.5l.75 6.5H8.5l.75-6.5z"
        fill="currentColor"
        opacity="0.22"
      />
      <path
        d="M9.25 14h5.5l.75 6.5H8.5l.75-6.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 4H3v1.2a3.2 3.2 0 0 0 2.6 3.1M19.5 4H21v1.2a3.2 3.2 0 0 1-2.6 3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

type NavVariant = 'fun' | 'rank' | 'competition'

const nav: {
  to: string
  label: string
  Icon: (props: NavIconProps) => React.ReactElement
  variant: NavVariant
  match: RegExp
}[] = [
  {
    to: '/fun',
    label: 'Fun',
    Icon: IconFun,
    variant: 'fun',
    match: /^\/(fun|find|week|make|admin\/games)/,
  },
  { to: '/', label: 'Rank', Icon: IconRank, variant: 'rank', match: /^\/$/ },
  {
    to: '/competitions',
    label: 'Competition',
    Icon: IconCompetition,
    variant: 'competition',
    match: /^\/(competitions|admin\/seasons)/,
  },
]

function isActive(path: string, item: (typeof nav)[number]) {
  return item.match.test(path)
}

function tabClass(active: boolean, variant: NavVariant) {
  return `game-tab min-w-0 gap-0.5 game-tab-${variant}${active ? ' game-tab-selected' : ''}`
}

export function Layout() {
  const { profile } = useAuth()
  const loc = useLocation()
  const navigate = useNavigate()
  const onProfile = loc.pathname === '/profile'

  const openProfile = () => {
    if (!onProfile) navigate('/profile')
  }

  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {onProfile ? (
          <>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm font-medium text-brand-accent"
            >
              ← Back
            </button>
            <p className="min-w-0 truncate text-sm font-medium text-brand-primary">
              {profile?.display_name ?? 'Profile'}
            </p>
          </>
        ) : (
          <>
            <img
              src="/brand/logo-padel.webp"
              alt="Success Padel"
              className="h-8 w-auto max-w-[7rem] shrink-0"
            />
            <button
              type="button"
              onClick={openProfile}
              className="max-w-[45%] truncate rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-medium text-brand-primary"
            >
              {profile?.display_name ?? 'Profile'}
            </button>
          </>
        )}
      </header>

      <main data-scroll-y className="scroll-y min-h-0 min-w-0 flex-1 px-3 pb-2 pt-1">
        <div className="w-full min-w-0 max-w-full">
          {onProfile ? <Profile /> : <Outlet />}
        </div>
      </main>

      <nav
        className={`game-dock w-full min-w-0 shrink-0 ${onProfile ? 'hidden' : ''}`}
        aria-label="Play modes"
      >
        <div className="game-dock-inner min-w-0 max-w-full">
          {nav.map((item) => {
            const active = isActive(loc.pathname, item)
            const iconSize = 'h-5 w-5'
            return (
              <Link key={item.to} to={item.to} className={tabClass(active, item.variant)}>
                <item.Icon className={`game-tab-icon shrink-0 ${iconSize}`} />
                <span className="max-w-full truncate font-display text-[11px] leading-tight">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
