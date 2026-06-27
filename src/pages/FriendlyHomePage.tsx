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
      currentTabAddon={
        isAdmin ? (
          <Link
            to="/friendly/new"
            aria-label={t('friendly.addGameFab')}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-accent text-white shadow-sm active:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
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
