import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FriendlyGamesList } from '../components/FriendlyGamesList'
import { GamesHubView } from '../components/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { usePublicFriendlyGames } from '../hooks/usePublicFriendlyGames'
import { useTranslation } from '../hooks/useTranslation'

export function FriendlyHomePage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { games, loading, error, refresh } = usePublicFriendlyGames()
  const isAdmin = Boolean(profile?.is_admin)
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/friendly') void refresh()
  }, [location.pathname, refresh])

  return (
    <GamesHubView
      leaderboardVariant="friendly"
      currentCount={games.length}
      currentPanel={
        <>
          {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
          <FriendlyGamesList games={games} loading={loading} isAdmin={isAdmin} />
        </>
      }
      fab={
        isAdmin ? (
          <Link
            to="/friendly/new"
            aria-label={t('friendly.addGameFab')}
            className="fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-2xl font-semibold leading-none text-white shadow-lg bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
          >
            +
          </Link>
        ) : null
      }
    />
  )
}
