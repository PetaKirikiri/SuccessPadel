import type React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { AppShellColumn } from './AppShellColumn'

type NavIconProps = { className?: string }

function IconFriendly({ className }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" opacity="0.2" />
      <path
        d="M3 12h18M12 5v14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="9" r="1.25" fill="currentColor" />
      <circle cx="16" cy="15" r="1.25" fill="currentColor" />
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

function isCompetitivePath(path: string): boolean {
  return path === '/competitive' || path.startsWith('/competitions')
}

const navItems: {
  to: string
  labelKey: 'nav.friendly' | 'nav.competitive'
  Icon: (props: NavIconProps) => React.ReactElement
  variant: NavVariant
  isActive: (path: string) => boolean
}[] = [
  {
    to: '/friendly',
    labelKey: 'nav.friendly',
    Icon: IconFriendly,
    variant: 'rank',
    isActive: (path) => path === '/friendly' || path.startsWith('/friendly/'),
  },
  {
    to: '/competitive',
    labelKey: 'nav.competitive',
    Icon: IconCompetition,
    variant: 'competition',
    isActive: isCompetitivePath,
  },
]

function tabClass(active: boolean, variant: NavVariant) {
  return `game-tab min-w-0 gap-0.5 game-tab-${variant}${active ? ' game-tab-selected' : ''}`
}

export function AppBottomNav() {
  const { t } = useTranslation()
  const loc = useLocation()

  return (
    <nav
      className="w-full min-w-0 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5"
      aria-label={t('aria.playModes')}
    >
      <AppShellColumn>
        <div className="game-dock-inner !mx-0 !max-w-none w-full !rounded-xl">
          {navItems.map((item) => {
            const active = item.isActive(loc.pathname)
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
      </AppShellColumn>
    </nav>
  )
}
