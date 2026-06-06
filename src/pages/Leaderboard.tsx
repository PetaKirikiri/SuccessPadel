import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { RankingTable } from '../components/RankingTable'
import type { RankMode } from '../lib/types'

export function Leaderboard() {
  const { user } = useAuth()
  const [mode, setMode] = useState<RankMode>('solo')
  const { season, soloRows, duosRows, loading, error } = useLeaderboard(mode)

  if (loading) return <p className="game-subtle">Loading…</p>

  return (
    <div className="w-full min-w-0 max-w-full space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <RankingTable
        mode={mode}
        onModeChange={setMode}
        seasonName={season?.name}
        soloRows={soloRows}
        duosRows={duosRows}
        currentUserId={user?.id}
      />
    </div>
  )
}
