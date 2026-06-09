import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { GamesHubEmpty } from '../components/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { buildFriendlyLeaderboardEntries } from '../lib/friendlyLeaderboard'

type Props = {
  embedded?: boolean
}

export function FriendlyLeaderboard({ embedded = false }: Props) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const entries = buildFriendlyLeaderboardEntries()

  if (entries.length === 0) {
    const empty = (
      <GamesHubEmpty>
        <p className="text-brand-muted">{t('friendly.noLeaderboardScores')}</p>
        <p className="text-xs text-brand-muted">{t('friendly.noLeaderboardHint')}</p>
      </GamesHubEmpty>
    )
    return embedded ? <div className="px-3 py-3">{empty}</div> : <div className="game-card">{empty}</div>
  }

  return (
    <CompetitionLeaderboard
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
