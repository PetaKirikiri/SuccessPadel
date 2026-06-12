import { useState } from 'react'
import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { LeaderboardFilters } from '../components/LeaderboardFilters'
import { GamesHubEmpty, GamesHubLoading } from '../components/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { DEFAULT_LEADERBOARD_FILTERS } from '../lib/leaderboardFilters'
import { useSeasonLeaderboard } from '../hooks/useSeasonLeaderboard'

type Props = {
  embedded?: boolean
}

export function Leaderboard({ embedded = false }: Props) {
  const [filters, setFilters] = useState(DEFAULT_LEADERBOARD_FILTERS)
  const { season, entries, loading, error } = useSeasonLeaderboard(true, filters)
  const { user } = useAuth()
  const { t } = useTranslation()

  const weeksLeftLabel = (weeksLeft: number): string =>
    weeksLeft === 1 ? t('leaderboard.weekLeft') : t('leaderboard.weeksLeft', { count: weeksLeft })

  const embeddedPad = embedded ? 'min-h-full bg-brand-surface px-3 py-3' : ''
  const filterBar = <LeaderboardFilters filters={filters} onChange={setFilters} />

  if (loading) {
    return embedded ? (
      <div className={embeddedPad}>
        {filterBar}
        <GamesHubLoading />
      </div>
    ) : (
      <>
        {filterBar}
        <GamesHubLoading />
      </>
    )
  }

  if (error) {
    return (
      <div className={embedded ? embeddedPad : 'space-y-2'}>
        {filterBar}
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!season) {
    const empty = (
      <GamesHubEmpty>
        <p>{t('leaderboard.noSeason')}</p>
        <p className="text-xs text-brand-muted">{t('leaderboard.noSeasonHint')}</p>
      </GamesHubEmpty>
    )
    return embedded ? (
      <div className={embeddedPad}>
        {filterBar}
        {empty}
      </div>
    ) : (
      <>
        {filterBar}
        <div className="game-card">{empty}</div>
      </>
    )
  }

  if (entries.length > 0) {
    return (
      <CompetitionLeaderboard
        entries={entries}
        scoreUnit="points"
        headerTitle={embedded ? null : season.name}
        headerSubtitle={weeksLeftLabel(season.weeks_left)}
        headerExtra={filterBar}
        currentUserId={user?.id ?? null}
        competitionId={null}
        embedded={embedded}
      />
    )
  }

  const empty = (
    <GamesHubEmpty>
      {!embedded ? (
        <p className="font-display text-base font-semibold text-brand-primary">{season.name}</p>
      ) : null}
      <p className="text-xs text-brand-muted">{weeksLeftLabel(season.weeks_left)}</p>
      <p className="text-brand-muted">{t('leaderboard.noScores')}</p>
      <p className="text-xs text-brand-muted">{t('leaderboard.noScoresFilterHint')}</p>
    </GamesHubEmpty>
  )

  return embedded ? (
    <div className={embeddedPad}>
      {filterBar}
      {empty}
    </div>
  ) : (
    <>
      {filterBar}
      <div className="game-card">{empty}</div>
    </>
  )
}
