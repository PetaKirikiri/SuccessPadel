import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { FriendlyGamesList } from '../components/FriendlyGamesList'
import { GamesHubView } from '../components/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { usePublicFriendlyGames } from '../hooks/usePublicFriendlyGames'
import { useTranslation } from '../hooks/useTranslation'
import { splitFriendlyGames } from '../lib/friendlyGames'

export function FriendlyHomePage() {
  const { t } = useTranslation()
  const { profile, loading: authLoading } = useAuth()
  const { games, loading, error, refresh } = usePublicFriendlyGames()
  const isAdmin = !authLoading && Boolean(profile?.is_admin)
  const location = useLocation()
  const lineError = (location.state as { lineError?: string } | null)?.lineError
  const { currentGames, pastGames } = useMemo(() => splitFriendlyGames(games), [games])

  useEffect(() => {
    if (location.pathname === '/friendly') void refresh()
  }, [location.pathname, refresh])

  const listProps = {
    loading,
    isAdmin,
    onRefresh: refresh,
  }

  const errorBanner = (
    <>
      {lineError ? <p className="mb-2 text-xs text-red-600">{lineError}</p> : null}
      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
    </>
  )

  return (
    <GamesHubView
      showPastTab
      currentCount={currentGames.length}
      pastCount={pastGames.length}
      fab={
        isAdmin ? (
          <Link
            to="/friendly/new"
            aria-label={t('friendly.addGameFab')}
            className="fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-white shadow-lg bottom-[calc(var(--app-shell-dock-height)+0.75rem)]"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </Link>
        ) : null
      }
      currentPanel={
        <>
          {errorBanner}
          <FriendlyGamesList games={currentGames} {...listProps} />
        </>
      }
      pastPanel={
        <>
          {errorBanner}
          <FriendlyGamesList games={pastGames} past {...listProps} />
        </>
      }
    />
  )
}
