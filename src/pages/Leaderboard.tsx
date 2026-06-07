import { useState } from 'react'
import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { useGuestPlayerClaim } from '../hooks/useGuestPlayerClaim'
import { useSeasonLeaderboard } from '../hooks/useSeasonLeaderboard'

function weeksLeftLabel(weeksLeft: number): string {
  if (weeksLeft === 1) return '1 week left'
  return `${weeksLeft} weeks left`
}

export function Leaderboard() {
  const { season, entries, loading, error, refresh } = useSeasonLeaderboard()
  const [claimError, setClaimError] = useState<string | null>(null)
  const { userId, claimNow } = useGuestPlayerClaim({
    competitionId: null,
    onClaimed: () => {
      setClaimError(null)
      void refresh(true)
    },
  })

  const handleGuestClaim = async (padelPlayerId: string) => {
    try {
      setClaimError(null)
      await claimNow(padelPlayerId)
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : 'Could not link scores')
    }
  }

  if (loading) return <p className="game-subtle">Loading…</p>

  return (
    <div className="w-full min-w-0 max-w-full space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {claimError && <p className="text-sm text-red-600">{claimError}</p>}
      {!season ? (
        <div className="game-card px-4 py-6 text-center">
          <p className="text-sm text-brand-text">No season standings yet.</p>
          <p className="mt-1 text-xs text-brand-muted">
            Rankings appear here after competitions go live.
          </p>
        </div>
      ) : entries.length > 0 ? (
            <CompetitionLeaderboard
              entries={entries}
              scoreUnit="points"
              headerTitle={season.name}
              headerSubtitle={weeksLeftLabel(season.weeks_left)}
              showLeaderFooter={false}
              currentUserId={userId}
              competitionId={null}
              onGuestClaim={(id) => void handleGuestClaim(id)}
            />
      ) : (
        <div className="game-card px-4 py-6 text-center">
          <p className="font-display text-base font-semibold text-brand-primary">{season.name}</p>
          <p className="mt-1 text-xs text-brand-muted">{weeksLeftLabel(season.weeks_left)}</p>
          <p className="mt-3 text-sm text-brand-muted">No scores recorded yet.</p>
        </div>
      )}
    </div>
  )
}
