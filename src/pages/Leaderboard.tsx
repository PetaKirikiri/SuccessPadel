import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { useSeasonLeaderboard } from '../hooks/useSeasonLeaderboard'

export function Leaderboard() {
  const { season, entries, loading, error } = useSeasonLeaderboard()
  const { user } = useAuth()
  const { t } = useTranslation()

  const weeksLeftLabel = (weeksLeft: number): string =>
    weeksLeft === 1 ? t('leaderboard.weekLeft') : t('leaderboard.weeksLeft', { count: weeksLeft })

  if (loading) return <p className="game-subtle">{t('common.loading')}</p>

  return (
    <div className="w-full min-w-0 max-w-full space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!season ? (
        <div className="game-card px-4 py-6 text-center">
          <p className="text-sm text-brand-text">{t('leaderboard.noSeason')}</p>
          <p className="mt-1 text-xs text-brand-muted">{t('leaderboard.noSeasonHint')}</p>
        </div>
      ) : entries.length > 0 ? (
        <CompetitionLeaderboard
          entries={entries}
          scoreUnit="points"
          headerTitle={season.name}
          headerSubtitle={weeksLeftLabel(season.weeks_left)}
          currentUserId={user?.id ?? null}
          competitionId={null}
        />
      ) : (
        <div className="game-card px-4 py-6 text-center">
          <p className="font-display text-base font-semibold text-brand-primary">{season.name}</p>
          <p className="mt-1 text-xs text-brand-muted">{weeksLeftLabel(season.weeks_left)}</p>
          <p className="mt-3 text-sm text-brand-muted">{t('leaderboard.noScores')}</p>
        </div>
      )}
    </div>
  )
}
