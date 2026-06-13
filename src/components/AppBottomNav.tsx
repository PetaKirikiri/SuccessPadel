import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { IconCompetition, IconFriendly, shellTabClass } from './ShellTabIcons'

type NavVariant = 'rank' | 'competition'

function isCompetitivePath(path: string): boolean {
  return path === '/competitive' || path.startsWith('/competitions')
}

const navItems: {
  to: string
  labelKey: 'nav.friendly' | 'nav.competitive'
  Icon: typeof IconFriendly
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

export function AppBottomNav({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation()
  const loc = useLocation()

  const tabs = navItems.map((item) => {
    const active = item.isActive(loc.pathname)
    return (
      <Link key={item.to} to={item.to} className={shellTabClass(active, item.variant)}>
        <item.Icon />
        <span className="max-w-full truncate text-[11px] leading-tight md:text-sm">{t(item.labelKey)}</span>
      </Link>
    )
  })

  if (embedded) {
    return (
      <nav className="app-shell-panel-footer gap-0" aria-label={t('aria.playModes')}>
        {tabs}
      </nav>
    )
  }

  return (
    <nav className="app-shell-dock" aria-label={t('aria.playModes')}>
      <div className="app-shell-dock-inner">{tabs}</div>
    </nav>
  )
}
