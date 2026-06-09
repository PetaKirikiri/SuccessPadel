import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FriendlyGameCard } from './FriendlyGameCard'
import { GamesHubEmpty, GamesHubLoading } from './GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useTranslation } from '../hooks/useTranslation'
import { supabase } from '../lib/supabaseClient'
import type { FriendlyGameRecord } from '../lib/friendlyGames'

type Props = {
  games: FriendlyGameRecord[]
  loading: boolean
  past?: boolean
  isAdmin?: boolean
}

export function FriendlyGamesList({ games, loading, past = false, isAdmin = false }: Props) {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const [courtNames, setCourtNames] = useState<string[]>([])

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.rpc('list_setup_courts')
      if (active && Array.isArray(data)) {
        setCourtNames(
          (data as { name: string; sort_order: number }[])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => c.name),
        )
      }
    })()
    return () => {
      active = false
    }
  }, [])

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
            currentUserAvatarUrl={headerAvatar}
            isAdmin={isAdmin}
            courtNames={courtNames}
            showCourts={!past}
          />
        </li>
      ))}
    </ul>
  )
}
