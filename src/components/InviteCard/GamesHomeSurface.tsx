import { useAuth } from '../../hooks/useAuth'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { canonicalCompetitionInviteLocation } from '../../lib/competitionInviteLink'
import { GamesList } from './GamesList'
import { GamesHubView } from './GamesHubView'

type Mode = 'friendly' | 'competitive'

export function GamesHomePage({ mode }: { mode: Mode }) {
  const { user, profile, loading: authLoading } = useAuth()
  const location = useLocation()
  const { inviteCode } = useParams<{ inviteCode: string }>()
  const competitionId = inviteCode ?? new URLSearchParams(location.search).get('competition')
  const isAdmin = !authLoading && Boolean(profile?.is_admin)
  const lineError = (location.state as { lineError?: string } | null)?.lineError

  if (mode === 'competitive') {
    const canonical = canonicalCompetitionInviteLocation(location.pathname, location.search, location.hash)
    if (canonical && canonical !== `${location.pathname}${location.search}${location.hash}`) {
      return <Navigate to={canonical} replace state={location.state} />
    }
    return (
      <GamesHubView
        showPastTab
        hubNav="none"
        showGenderFilter={competitionId === null}
        pinnedToCurrent={competitionId !== null}
        currentPanel={
          <GamesList
            mode="competitive"
            listTab="current"
            isAdmin={isAdmin}
            userId={user?.id}
            showListTabs={false}
            competitionId={competitionId}
          />
        }
        pastPanel={
          <GamesList
            mode="competitive"
            listTab="past"
            isAdmin={isAdmin}
            userId={user?.id}
            showListTabs={false}
            competitionId={competitionId}
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
