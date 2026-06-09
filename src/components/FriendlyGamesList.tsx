import { Link } from 'react-router-dom'
import { FriendlyGameCard } from './FriendlyGameCard'
import { GamesHubEmpty, GamesHubLoading } from './GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import type { FriendlyGameRecord } from '../lib/friendlyGames'

type Props = {
  games: FriendlyGameRecord[]
  loading: boolean
  past?: boolean
  isAdmin?: boolean
}

export function FriendlyGamesList({ games, loading, past = false, isAdmin = false }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()

  if (loading) return <GamesHubLoading />

  if (games.length === 0) {
    return (
      <GamesHubEmpty>
        <p className="text-brand-muted">
          {past ? t('competition.noPastGames') : t('friendly.noGames')}
        </p>
        {!past && isAdmin ? (
          <Link to="/friendly/new" className="text-sm font-semibold text-brand-accent">
            {t('friendly.addGame')}
          </Link>
        ) : null}
      </GamesHubEmpty>
    )
  }

  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {games.map((game) => (
        <li key={game.id}>
          <FriendlyGameCard
            game={game}
            to={`/friendly/${game.id}`}
            currentUserId={user?.id}
            showJoinHint={!past}
          />
        </li>
      ))}
    </ul>
  )
}
