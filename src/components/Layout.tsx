import type React from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LineBookmarkBanner } from './LineBookmarkBanner'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { firstDisplayName } from '../lib/leaderboardEntries'

type NavIconProps = { className?: string }

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

type NavVariant = 'rank' | 'competition'

const nav: {
  to: string
  label: string
  Icon: (props: NavIconProps) => React.ReactElement
  variant: NavVariant
  match: RegExp
}[] = [
  { to: '/', label: 'Leaderboard', Icon: IconRank, variant: 'rank', match: /^\/$/ },
  {
    to: '/competitions',
    label: 'Competition',
    Icon: IconCompetition,
    variant: 'competition',
    match: /^\/competitions/,
  },
]

function isActive(path: string, item: (typeof nav)[number]) {
  return item.match.test(path)
}

function tabClass(active: boolean, variant: NavVariant) {
  return `game-tab min-w-0 gap-0.5 game-tab-${variant}${active ? ' game-tab-selected' : ''}`
}

export function Layout() {
  const { profile, user } = useAuth()
  const lineClient = useLineClientProfile()
  const loc = useLocation()
  const navigate = useNavigate()
  const onProfile = loc.pathname === '/profile'

  const headerName = firstDisplayName(profile?.display_name ?? lineClient.displayName)
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const showProfileChip = Boolean(user)

  const openProfile = () => {
    if (onProfile || !user) return
    navigate('/profile')
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
              {firstDisplayName(profile?.display_name)}
            </p>
          </>
        ) : (
          <>
            <img
              src="/brand/logo-padel.webp"
              alt="Success Padel"
              className="h-8 w-auto max-w-[7rem] shrink-0"
            />
            {showProfileChip ? (
              <button
                type="button"
                onClick={openProfile}
                className="flex max-w-[45%] items-center gap-2 truncate rounded-full border border-brand-border bg-brand-surface py-1.5 pl-1.5 pr-3 text-xs font-medium text-brand-primary"
              >
                {headerAvatar ? (
                  <img
                    src={headerAvatar}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <span className="truncate">{headerName}</span>
              </button>
            ) : null}
          </>
        )}
      </header>

      <main data-scroll-y className="scroll-y min-h-0 min-w-0 flex-1 px-3 pb-2 pt-1">
        <div className="w-full min-w-0 max-w-full">
          <LineBookmarkBanner />
          <Outlet />
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
