import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { GamesGenderFilterProvider } from '../contexts/GamesGenderFilterContext'
import { useTranslation } from '../hooks/useTranslation'
import { useSeasonLeaderboard } from '../hooks/useSeasonLeaderboard'
import type { Gender } from '../lib/competitionPresets'
import { consumeStoredCompetitiveGenderFilter } from '../lib/gamesGenderFilter'
import { Leaderboard } from '../pages/Leaderboard'
import {
  IconHubCurrent,
  IconHubLeaderboard,
  IconHubPast,
  shellTabClass,
} from './ShellTabIcons'

export type GamesHubTab = 'current' | 'past' | 'leaderboard'

type LeaderboardVariant = 'competition' | 'friendly'

type Props = {
  currentCount: number
  currentPanel: ReactNode
  /** Tab row (competition), title bar, or none (friendly list only). */
  hubNav?: 'tabs' | 'title' | 'none'
  /** Title bar label when hubNav is title. */
  titleLabel?: string
  /** Control beside title (e.g. admin + to add). */
  titleAddon?: ReactNode
  /** Nested control inside the Current games tab (e.g. admin + to add). */
  currentTabAddon?: ReactNode
  fab?: ReactNode
  showPastTab?: boolean
  pastCount?: number
  pastPanel?: ReactNode
  leaderboardVariant?: LeaderboardVariant
  /** Background for the tab content area (e.g. friendly list on cream). */
  listClassName?: string
  /** Gender filter on invite card banners. */
  showGenderFilter?: boolean
}

function HubTab({
  active,
  onClick,
  label,
  icon: Icon,
  variant,
  addon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: (props: { className?: string }) => ReactElement
  variant: 'rank' | 'competition'
  addon?: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={shellTabClass(active, variant)}
    >
      <Icon />
      <span className="min-w-0 flex-1 truncate text-left text-xs leading-tight md:text-sm">{label}</span>
      {addon ? <div className="shrink-0">{addon}</div> : null}
    </button>
  )
}

export function GamesHubLoading() {
  const { t } = useTranslation()
  return <p className="py-8 text-center text-sm text-brand-muted">{t('common.loading')}</p>
}

export function GamesHubEmpty({ children }: { children: ReactNode }) {
  return <div className="space-y-2 py-8 text-center text-sm text-brand-text">{children}</div>
}

export function GamesHubList({ children }: { children: ReactNode }) {
  return <ul className="m-0 list-none divide-y divide-brand-border/50 p-0">{children}</ul>
}

function HubTitleBar({ label, addon }: { label: string; addon?: ReactNode }) {
  return (
    <nav className="app-shell-panel-header items-center px-3 py-2">
      <h2 className="min-w-0 flex-1 font-display text-sm font-semibold text-brand-primary md:text-base">
        {label}
      </h2>
      {addon ? <div className="shrink-0">{addon}</div> : null}
    </nav>
  )
}

export function GamesHubView({
  currentCount,
  currentPanel,
  hubNav = 'tabs',
  titleLabel,
  titleAddon,
  currentTabAddon,
  fab,
  showPastTab = false,
  pastCount = 0,
  pastPanel,
  leaderboardVariant = 'competition',
  listClassName = '',
  showGenderFilter = true,
}: Props) {
  const { t } = useTranslation()
  const { season } = useSeasonLeaderboard(leaderboardVariant === 'competition')
  const [tab, setTab] = useState<GamesHubTab>('current')
  const [genderFilter, setGenderFilter] = useState<Gender>('Men')
  const didDefaultTab = useRef(false)

  useEffect(() => {
    const stored = consumeStoredCompetitiveGenderFilter()
    if (stored) setGenderFilter(stored)
  }, [])

  useEffect(() => {
    if (!showPastTab || didDefaultTab.current) return
    didDefaultTab.current = true
    if (currentCount === 0 && pastCount > 0) setTab('past')
  }, [showPastTab, currentCount, pastCount])

  const leaderboardLabel = season?.name
    ? t('hub.seasonLeaderboard', { name: season.name })
    : t('nav.leaderboard')

  const showGenderFilterControls =
    showGenderFilter && (hubNav !== 'tabs' || tab !== 'leaderboard')

  const listContent =
    hubNav !== 'tabs' ? (
      <div className={`w-full min-w-0 max-w-full overflow-x-hidden ${listClassName}`}>
        {currentPanel}
      </div>
    ) : tab === 'leaderboard' ? (
      <div className="min-h-full bg-brand-surface">
        <Leaderboard embedded />
      </div>
    ) : (
      <div className={`w-full min-w-0 max-w-full overflow-x-hidden ${listClassName}`}>
        {tab === 'current' ? currentPanel : pastPanel}
      </div>
    )

  const listBody = showGenderFilterControls ? (
    <GamesGenderFilterProvider gender={genderFilter} setGender={setGenderFilter}>
      {listContent}
    </GamesGenderFilterProvider>
  ) : (
    listContent
  )

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 basis-0 flex-col overflow-hidden">
      {fab}

      {hubNav === 'title' ? (
        <HubTitleBar label={titleLabel ?? t('friendly.games')} addon={titleAddon} />
      ) : hubNav === 'none' ? null : (
        <nav className="app-shell-panel-header gap-0" role="tablist" aria-label={t('aria.playModes')}>
            <HubTab
              active={tab === 'current'}
              onClick={() => setTab('current')}
              label={`${t('competition.currentGames')}${currentCount > 0 ? ` (${currentCount})` : ''}`}
              icon={IconHubCurrent}
              variant="competition"
              addon={currentTabAddon}
            />
            {showPastTab ? (
              <HubTab
                active={tab === 'past'}
                onClick={() => setTab('past')}
                label={`${t('competition.pastGames')}${pastCount > 0 ? ` (${pastCount})` : ''}`}
                icon={IconHubPast}
                variant="competition"
              />
            ) : null}
            <HubTab
              active={tab === 'leaderboard'}
              onClick={() => setTab('leaderboard')}
              label={leaderboardLabel}
              icon={IconHubLeaderboard}
              variant="rank"
            />
        </nav>
      )}

      <div
        data-scroll-y
        className="app-shell-panel-inset scroll-y min-h-0 min-w-0 w-full max-w-full flex-1 basis-0"
        role="tabpanel"
      >
        {listBody}
      </div>
    </div>
  )
}
