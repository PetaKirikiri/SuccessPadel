import { useState } from 'react'
import { Leaderboard as LeaderboardTable, LeaderboardFilters } from '../components/leaderboard'
import { GamesHubEmpty, GamesHubLoading } from '../components/hub/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { buildFriendlyLeaderboardEntries } from '../lib/friendlyLeaderboard'
import { DEFAULT_LEADERBOARD_FILTERS } from '../lib/leaderboardFilters'
import { useSeasonLeaderboard } from '../hooks/useSeasonLeaderboard'

type Props = {
  embedded?: boolean
  source?: 'season' | 'friendly'
}

export function Leaderboard({ embedded = false, source = 'season' }: Props) {
  const [filters, setFilters] = useState(DEFAULT_LEADERBOARD_FILTERS)
  const seasonEnabled = source === 'season'
  const { season, entries: seasonEntries, loading, error } = useSeasonLeaderboard(seasonEnabled, filters)
  const { user } = useAuth()
  const { t } = useTranslation()

  const friendlyEntries = source === 'friendly' ? buildFriendlyLeaderboardEntries() : []
  const entries = source === 'friendly' ? friendlyEntries : seasonEntries

  const weeksLeftLabel = (weeksLeft: number): string =>
    weeksLeft === 1 ? t('leaderboard.weekLeft') : t('leaderboard.weeksLeft', { count: weeksLeft })

  const embeddedPad = embedded ? 'min-h-full bg-brand-surface px-3 py-3' : ''
  const filterBar = seasonEnabled ? <LeaderboardFilters filters={filters} onChange={setFilters} /> : null

  if (seasonEnabled && loading) {
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

  if (seasonEnabled && error) {
    return (
      <div className={embedded ? embeddedPad : 'space-y-2'}>
        {filterBar}
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (seasonEnabled && !season) {
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
    if (source === 'friendly') {
      return (
        <LeaderboardTable
          entries={entries}
          scoreUnit="games"
          scoreColumnLabel={t('leaderboard.wins')}
          headerTitle={embedded ? null : t('friendly.leaderboard')}
          headerSubtitle={t('friendly.leaderboardSubtitle')}
          currentUserId={user?.id ?? null}
          competitionId={null}
          embedded={embedded}
        />
      )
    }

    return (
      <LeaderboardTable
        entries={entries}
        scoreUnit="points"
        headerTitle={embedded ? null : season!.name}
        headerSubtitle={weeksLeftLabel(season!.weeks_left)}
        headerExtra={filterBar}
        currentUserId={user?.id ?? null}
        competitionId={null}
        embedded={embedded}
      />
    )
  }

  const empty =
    source === 'friendly' ? (
      <GamesHubEmpty>
        <p className="text-brand-muted">{t('friendly.noLeaderboardScores')}</p>
        <p className="text-xs text-brand-muted">{t('friendly.noLeaderboardHint')}</p>
      </GamesHubEmpty>
    ) : (
      <GamesHubEmpty>
        {!embedded ? (
          <p className="font-display text-base font-semibold text-brand-primary">{season!.name}</p>
        ) : null}
        <p className="text-xs text-brand-muted">{weeksLeftLabel(season!.weeks_left)}</p>
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
