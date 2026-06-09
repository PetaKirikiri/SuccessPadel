import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { GamesHubEmpty, GamesHubLoading } from '../components/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { useSeasonLeaderboard } from '../hooks/useSeasonLeaderboard'

type Props = {
  embedded?: boolean
}

export function Leaderboard({ embedded = false }: Props) {
  const { season, entries, loading, error } = useSeasonLeaderboard()
  const { user } = useAuth()
  const { t } = useTranslation()

  const weeksLeftLabel = (weeksLeft: number): string =>
    weeksLeft === 1 ? t('leaderboard.weekLeft') : t('leaderboard.weeksLeft', { count: weeksLeft })

  const embeddedPad = embedded ? 'px-3 py-3' : ''

  if (loading) {
    return embedded ? (
      <div className={embeddedPad}>
        <GamesHubLoading />
      </div>
    ) : (
      <GamesHubLoading />
    )
  }

  if (error) {
    return (
      <div className={embedded ? embeddedPad : 'space-y-2'}>
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
    return embedded ? <div className={embeddedPad}>{empty}</div> : <div className="game-card">{empty}</div>
  }

  if (entries.length > 0) {
    return (
      <CompetitionLeaderboard
        entries={entries}
        scoreUnit="points"
        headerTitle={embedded ? null : season.name}
        headerSubtitle={weeksLeftLabel(season.weeks_left)}
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
    </GamesHubEmpty>
  )

  return embedded ? <div className={embeddedPad}>{empty}</div> : <div className="game-card">{empty}</div>
}
