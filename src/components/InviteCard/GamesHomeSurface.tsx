import { useAuth } from '../../hooks/useAuth'
import { useLocation } from 'react-router-dom'
import { GamesList } from './GamesList'
import { GamesHubView } from './GamesHubView'

type Mode = 'friendly' | 'competitive'

export function GamesHomePage({ mode }: { mode: Mode }) {
  const { user, profile, loading: authLoading } = useAuth()
  const location = useLocation()
  const isAdmin = !authLoading && Boolean(profile?.is_admin)
  const lineError = (location.state as { lineError?: string } | null)?.lineError

  if (mode === 'competitive') {
    return (
      <GamesHubView
        showPastTab
        hubNav="none"
        currentPanel={
          <GamesList
            mode="competitive"
            listTab="current"
            isAdmin={isAdmin}
            userId={user?.id}
            showListTabs={false}
          />
        }
        pastPanel={
          <GamesList
            mode="competitive"
            listTab="past"
            isAdmin={isAdmin}
            userId={user?.id}
            showListTabs={false}
          />
        }
      />
    )
  }

  return (
    <GamesHubView
      showPastTab
      hubNav="none"
      leaderboardVariant="friendly"
      currentPanel={
        <div className="flex min-h-0 flex-1 flex-col">
          {lineError ? <p className="mb-2 text-xs text-red-600">{lineError}</p> : null}
          <GamesList mode="friendly" isAdmin={isAdmin} />
        </div>
      }
      pastPanel={
        <div className="flex min-h-0 flex-1 flex-col">
          {lineError ? <p className="mb-2 text-xs text-red-600">{lineError}</p> : null}
          <GamesList mode="friendly" past isAdmin={isAdmin} />
        </div>
      }
    />
  )
}
