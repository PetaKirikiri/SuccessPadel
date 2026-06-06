import { useState } from 'react'
import { CourtScheduleGrid } from '../components/CourtScheduleGrid'
import { GameDetailSheet } from '../components/GameDetailSheet'
import { useAuth } from '../hooks/useAuth'
import { useCourtSchedule } from '../hooks/useCourtSchedule'
import { formatDateInput } from '../lib/courtSchedule'
import type { CourtScheduleCell } from '../lib/types'

export function FindGame() {
  const { profile, user } = useAuth()
  const [day, setDay] = useState(formatDateInput(new Date()))
  const { courts, cells, loading, refresh } = useCourtSchedule(day)
  const [selected, setSelected] = useState<CourtScheduleCell | null>(null)

  if (loading) return <p className="game-subtle">Loading…</p>

  return (
  <div className="w-full min-w-0 max-w-full overflow-hidden">
      <CourtScheduleGrid
        day={day}
        courts={courts}
        cells={cells}
        isAdmin={Boolean(profile?.is_admin)}
        onCellClick={setSelected}
        onDayChange={setDay}
      />

      <GameDetailSheet
        cell={selected}
        courts={courts}
        userId={user?.id}
        isAdmin={Boolean(profile?.is_admin)}
        onClose={() => setSelected(null)}
        onUpdated={() => void refresh()}
      />
    </div>
  )
}
