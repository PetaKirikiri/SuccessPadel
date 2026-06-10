import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { FriendlyGamesList } from '../components/FriendlyGamesList'
import { GamesHubView } from '../components/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { usePublicFriendlyGames } from '../hooks/usePublicFriendlyGames'

export function FriendlyHomePage() {
  const { profile, loading: authLoading } = useAuth()
  const { games, loading, error, refresh } = usePublicFriendlyGames()
  const isAdmin = !authLoading && Boolean(profile?.is_admin)
  const location = useLocation()
  const lineError = (location.state as { lineError?: string } | null)?.lineError

  useEffect(() => {
    if (location.pathname === '/friendly') void refresh()
  }, [location.pathname, refresh])

  return (
    <GamesHubView
      hubNav="none"
      listClassName="bg-brand-bg"
      currentCount={games.length}
      currentPanel={
        <>
          {lineError ? <p className="mb-2 text-xs text-red-600">{lineError}</p> : null}
          {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
          <FriendlyGamesList
            games={games}
            loading={loading}
            isAdmin={isAdmin}
            onRefresh={refresh}
          />
        </>
      }
    />
  )
}
