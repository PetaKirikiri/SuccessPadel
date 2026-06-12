import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { useSeasonLeaderboard } from '../hooks/useSeasonLeaderboard'
import { Leaderboard } from '../pages/Leaderboard'

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
}

function HubTab({
  active,
  onClick,
  label,
  addon,
}: {
  active: boolean
  onClick: () => void
  label: string
  addon?: ReactNode
}) {
  return (
    <div
      className={`game-tab game-tab-competition min-w-0 flex-1 flex-row items-center gap-1 px-2 py-2 ${
        active ? 'game-tab-active' : ''
      }`}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onClick}
        className="min-w-0 flex-1 truncate text-left font-display text-xs leading-tight md:text-sm"
      >
        {label}
      </button>
      {addon ? <div className="shrink-0">{addon}</div> : null}
    </div>
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
    <nav className="shrink-0 bg-brand-bg pb-1.5">
      <div className="game-dock-inner !mx-0 !max-w-none w-full !rounded-xl flex items-center gap-2 px-3 py-2">
        <h2 className="min-w-0 flex-1 font-display text-sm font-semibold text-brand-primary md:text-base">
          {label}
        </h2>
        {addon ? <div className="shrink-0">{addon}</div> : null}
      </div>
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
}: Props) {
  const { t } = useTranslation()
  const { season } = useSeasonLeaderboard(leaderboardVariant === 'competition')
  const [tab, setTab] = useState<GamesHubTab>('current')
  const didDefaultTab = useRef(false)

  useEffect(() => {
    if (!showPastTab || didDefaultTab.current) return
    didDefaultTab.current = true
    if (currentCount === 0 && pastCount > 0) setTab('past')
  }, [showPastTab, currentCount, pastCount])

  const leaderboardLabel = season?.name
    ? t('hub.seasonLeaderboard', { name: season.name })
    : t('nav.leaderboard')

  const listBody =
    hubNav !== 'tabs' ? (
      <div className={`w-full min-w-0 max-w-full overflow-x-hidden pt-1 ${listClassName}`}>
        {currentPanel}
      </div>
    ) : tab === 'leaderboard' ? (
      <div className="min-h-full bg-brand-surface">
        <Leaderboard embedded />
      </div>
    ) : (
      <div className={`w-full min-w-0 max-w-full overflow-x-hidden pt-1 ${listClassName}`}>
        {tab === 'current' ? currentPanel : pastPanel}
      </div>
    )

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
      {fab}

      {hubNav === 'title' ? (
        <HubTitleBar label={titleLabel ?? t('friendly.games')} addon={titleAddon} />
      ) : hubNav === 'none' ? null : (
        <nav className="shrink-0 bg-brand-bg pb-1.5" aria-label={t('aria.playModes')}>
          <div className="game-dock-inner !mx-0 !max-w-none w-full !rounded-xl" role="tablist">
            <HubTab
              active={tab === 'current'}
              onClick={() => setTab('current')}
              label={`${t('competition.currentGames')}${currentCount > 0 ? ` (${currentCount})` : ''}`}
              addon={currentTabAddon}
            />
            {showPastTab ? (
              <HubTab
                active={tab === 'past'}
                onClick={() => setTab('past')}
                label={`${t('competition.pastGames')}${pastCount > 0 ? ` (${pastCount})` : ''}`}
              />
            ) : null}
            <HubTab
              active={tab === 'leaderboard'}
              onClick={() => setTab('leaderboard')}
              label={leaderboardLabel}
            />
          </div>
        </nav>
      )}

      <div
        data-scroll-y
        className="scroll-y min-h-0 min-w-0 w-full max-w-full flex-1"
        role="tabpanel"
      >
        {listBody}
      </div>
    </div>
  )
}
