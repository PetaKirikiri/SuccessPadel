import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { GamesHubTab } from './hub/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import {
  IconCompetition,
  IconFriendly,
  IconHubCurrent,
  IconHubLeaderboard,
  IconHubPast,
  shellTabClass,
} from './ShellTabIcons'
import { ProfileChip } from './ProfileChip'
import { TemporaryPaletteButton } from './TemporaryPaletteButton'

type NavVariant = 'rank' | 'competition'
type HubKind = 'friendly' | 'competitive'

function isCompetitivePath(path: string): boolean {
  return path === '/competitive' || path.startsWith('/competitions')
}

function friendlyViewFromSearch(value: string | null): GamesHubTab {
  return value === 'past' || value === 'leaderboard' ? value : 'current'
}

const friendlyViews: {
  value: GamesHubTab
  labelKey: 'competition.currentGames' | 'competition.pastGames' | 'nav.leaderboard'
  Icon: (props: { className?: string }) => ReactElement
}[] = [
  { value: 'current', labelKey: 'competition.currentGames', Icon: IconHubCurrent },
  { value: 'past', labelKey: 'competition.pastGames', Icon: IconHubPast },
  { value: 'leaderboard', labelKey: 'nav.leaderboard', Icon: IconHubLeaderboard },
]

const hubConfigs: Record<HubKind, {
  rootPath: string
  labelKey: 'nav.friendly' | 'nav.competitive'
  Icon: (props: { className?: string }) => ReactElement
  variant: NavVariant
  isActive: (path: string) => boolean
  isHome: (path: string) => boolean
  actionPath: string
  actionLabelKey: 'friendly.addGameFab' | 'competition.addCompetitionFab'
}> = {
  friendly: {
    rootPath: '/friendly',
    labelKey: 'nav.friendly',
    Icon: IconFriendly,
    variant: 'rank',
    isActive: (path) => path === '/friendly' || path.startsWith('/friendly/'),
    isHome: (path) => path === '/friendly',
    actionPath: '/friendly/new',
    actionLabelKey: 'friendly.addGameFab',
  },
  competitive: {
    rootPath: '/competitive',
    labelKey: 'nav.competitive',
    Icon: IconCompetition,
    variant: 'competition',
    isActive: isCompetitivePath,
    isHome: (path) => path === '/competitive',
    actionPath: '/competitions/new',
    actionLabelKey: 'competition.addCompetitionFab',
  },
}

function HubNavItem({ kind }: { kind: HubKind }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const loc = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const config = hubConfigs[kind]
  const view = friendlyViewFromSearch(searchParams.get('view'))
  const active = friendlyViews.find((item) => item.value === view) ?? friendlyViews[0]
  const onHome = config.isHome(loc.pathname)
  const activeSection = config.isActive(loc.pathname)
  const isAdmin = Boolean(profile?.is_admin)
  const PrimaryIcon = config.Icon

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const choose = (next: GamesHubTab) => {
    setOpen(false)
    if (onHome) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev)
        if (next === 'current') params.delete('view')
        else params.set('view', next)
        return params
      }, { replace: true })
      return
    }
    navigate(next === 'current' ? config.rootPath : `${config.rootPath}?view=${next}`)
  }

  if (!onHome) {
    return (
      <Link to={config.rootPath} className={shellTabClass(activeSection, config.variant)}>
        <PrimaryIcon />
        <span
          className={`overflow-hidden truncate whitespace-nowrap text-[11px] leading-tight transition-all duration-200 md:text-sm ${
            activeSection ? 'max-w-[7rem] opacity-100' : 'max-w-0 opacity-0'
          }`}
        >
          {t(config.labelKey)}
        </span>
      </Link>
    )
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 basis-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`${shellTabClass(true, config.variant)} w-full ${open ? 'border-brand-gold text-brand-gold' : ''}`}
      >
        <PrimaryIcon />
        <span
          className="max-w-[7rem] overflow-hidden truncate whitespace-nowrap text-[11px] leading-tight opacity-100 transition-all duration-200 md:text-sm"
        >
          {t(config.labelKey)}
        </span>
        <active.Icon className="h-4 w-4 shrink-0 opacity-80 md:h-5 md:w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-1/2 z-[320] mb-2 w-[13rem] -translate-x-1/2 overflow-hidden rounded-xl border border-brand-border bg-brand-surface py-1 shadow-lg dark:border-white/15 dark:bg-[#11355c]"
        >
          {friendlyViews.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitemradio"
              aria-checked={view === item.value}
              onClick={() => choose(item.value)}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium transition hover:bg-brand-bg-alt active:bg-brand-bg-alt ${
                view === item.value ? 'text-brand-accent' : 'text-brand-primary'
              }`}
            >
              <item.Icon className="h-4 w-4 shrink-0" />
              {t(item.labelKey)}
            </button>
          ))}
          {isAdmin ? (
            <>
              <div className="my-1 border-t border-brand-border" role="separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  navigate(config.actionPath)
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-brand-primary transition hover:bg-brand-bg-alt active:bg-brand-bg-alt"
              >
                <Plus className="h-4 w-4 shrink-0 text-brand-accent" strokeWidth={2.5} aria-hidden />
                {t(config.actionLabelKey)}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function AppBottomNav({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation()
  const loc = useLocation()
  const friendlyActive = loc.pathname === '/friendly' || loc.pathname.startsWith('/friendly/')
  const competitiveActive = isCompetitivePath(loc.pathname)

  if (embedded) {
    return (
      <nav className="app-shell-panel-footer gap-0" aria-label={t('aria.playModes')}>
        <Link to="/friendly" className={shellTabClass(friendlyActive, 'rank')}>
          <IconFriendly />
          <span className="truncate text-xs leading-tight md:text-sm">{t('nav.friendly')}</span>
        </Link>
        <Link to="/competitive" className={shellTabClass(competitiveActive, 'competition')}>
          <IconCompetition />
          <span className="truncate text-xs leading-tight md:text-sm">{t('nav.competitive')}</span>
        </Link>
      </nav>
    )
  }

  return (
    <>
      <TemporaryPaletteButton />
      <nav className="shell-dock-inner app-shell-dock" aria-label={t('aria.playModes')}>
        <div className="app-shell-dock-inner">
          <HubNavItem kind="friendly" />
          <HubNavItem kind="competitive" />
          <ProfileChip navItem className="min-w-0 flex-1 basis-0" />
        </div>
      </nav>
    </>
  )
}
