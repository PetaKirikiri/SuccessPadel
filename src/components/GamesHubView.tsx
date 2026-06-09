import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { useSeasonLeaderboard } from '../hooks/useSeasonLeaderboard'
import { FriendlyLeaderboard } from '../pages/FriendlyLeaderboard'
import { Leaderboard } from '../pages/Leaderboard'

export type GamesHubTab = 'current' | 'past' | 'leaderboard'

type LeaderboardVariant = 'competition' | 'friendly'

type Props = {
  currentCount: number
  currentPanel: ReactNode
  fab?: ReactNode
  showPastTab?: boolean
  pastCount?: number
  pastPanel?: ReactNode
  leaderboardVariant?: LeaderboardVariant
}

function HubTab({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`game-tab min-w-0 flex-1 py-2 ${active ? 'game-tab-selected' : ''}`}
    >
      <span className="max-w-full truncate font-display text-xs leading-tight md:text-sm">
        {label}
      </span>
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
  return <ul className="-mx-3 m-0 list-none divide-y divide-brand-border/50 p-0">{children}</ul>
}

export function GamesHubView({
  currentCount,
  currentPanel,
  fab,
  showPastTab = false,
  pastCount = 0,
  pastPanel,
  leaderboardVariant = 'competition',
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

  const leaderboardLabel =
    leaderboardVariant === 'friendly'
      ? t('friendly.leaderboard')
      : season?.name
        ? t('hub.seasonLeaderboard', { name: season.name })
        : t('nav.leaderboard')

  return (
    <div className="relative w-full min-w-0">
      {fab}

      <article className="game-card overflow-hidden p-0" role="tabpanel">
        <div
          role="tablist"
          aria-label={t('aria.playModes')}
          className="flex gap-1 border-b border-brand-border/60 bg-brand-bg-alt/40 p-1.5"
        >
          <HubTab
            active={tab === 'current'}
            onClick={() => setTab('current')}
            label={`${t('competition.currentGames')}${currentCount > 0 ? ` (${currentCount})` : ''}`}
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

        <div className="min-h-[10rem]">
          {tab === 'leaderboard' ? (
            leaderboardVariant === 'friendly' ? (
              <FriendlyLeaderboard embedded />
            ) : (
              <Leaderboard embedded />
            )
          ) : (
            <div className="px-3 py-3">{tab === 'current' ? currentPanel : pastPanel}</div>
          )}
        </div>
      </article>
    </div>
  )
}
