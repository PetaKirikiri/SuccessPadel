import type React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'

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
      <path d="M7 4h10v2.8a5 5 0 0 1-10 0V4z" fill="currentColor" opacity="0.28" />
      <path
        d="M7 4h10v2.8a5 5 0 0 1-10 0V4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 11.5V14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.25 14h5.5l.75 6.5H8.5l.75-6.5z" fill="currentColor" opacity="0.22" />
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

const navItems: {
  to: string
  labelKey: 'nav.leaderboard' | 'nav.competition'
  Icon: (props: NavIconProps) => React.ReactElement
  variant: NavVariant
  match: RegExp
}[] = [
  { to: '/', labelKey: 'nav.leaderboard', Icon: IconRank, variant: 'rank', match: /^\/$/ },
  {
    to: '/competitions',
    labelKey: 'nav.competition',
    Icon: IconCompetition,
    variant: 'competition',
    match: /^\/competitions/,
  },
]

function tabClass(active: boolean, variant: NavVariant) {
  return `game-tab min-w-0 gap-0.5 game-tab-${variant}${active ? ' game-tab-selected' : ''}`
}

export function AppBottomNav() {
  const { t } = useTranslation()
  const loc = useLocation()

  return (
    <nav className="game-dock w-full min-w-0 shrink-0" aria-label={t('aria.playModes')}>
      <div className="game-dock-inner min-w-0 max-w-full">
        {navItems.map((item) => {
          const active = item.match.test(loc.pathname)
          const iconSize = 'h-5 w-5 md:h-6 md:w-6'
          return (
            <Link key={item.to} to={item.to} className={tabClass(active, item.variant)}>
              <item.Icon className={`game-tab-icon shrink-0 ${iconSize}`} />
              <span className="max-w-full truncate font-display text-[11px] leading-tight md:text-sm">
                {t(item.labelKey)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
