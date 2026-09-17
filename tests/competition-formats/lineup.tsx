import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ViewportProvider } from '../../src/contexts/ViewportContext'
import { CompetitionRoster } from '../../src/components/competition-formats/CompetitionRoster'
import { useCompetitionLineupDrag } from '../../src/hooks/useCompetitionLineupDrag'
import type { CompetitionPlayer } from '../../src/hooks/useCompetitions'
import { lineupSnapshot, occupantsInFixedSlots } from '../../src/lib/competitionLineupOrder'
import { supabase } from '../../src/lib/supabaseClient'
import '../../src/index.css'

// Test-only transport: the real hook and renderer run, but NO database writes.
const storageKey = 'lineup-regression-only'
const initial: CompetitionPlayer[] = Array.from({ length: 16 }, (_, i) => ({
  id: `fixture-slot-${i}`, rank_order: i + 1, guest_name: `Player ${i + 1}`,
  guest_email: null, profile_id: null, padel_player_id: null, profiles: null,
}))
let saved: CompetitionPlayer[] = JSON.parse(localStorage.getItem(storageKey) ?? 'null') ?? initial
const source = saved
const test = { calls: [] as unknown[], pending: [] as (() => void)[], hold: false, fail: false, attendance: 0 }
Object.assign(window, { lineupTest: test })
supabase.rpc = (async (name: string, args: { p_session_id: string; p_expected_slots: unknown; p_occupant_order: string[] }) => {
  test.calls.push({ name, ...args })
  if (test.hold) await new Promise<void>(resolve => test.pending.push(resolve))
  if (test.fail) return { error: { message: 'Test save rejected' } }
  if (name !== 'reorder_competition_slot_occupants' || args.p_session_id !== 'fixture-only' ||
      JSON.stringify(args.p_expected_slots) !== JSON.stringify(lineupSnapshot(saved))) {
    return { error: { message: 'Invalid or stale fixture request' } }
  }
  saved = occupantsInFixedSlots(saved, args.p_occupant_order.map(id => saved.find(player => player.id === id)!))
  localStorage.setItem(storageKey, JSON.stringify(saved))
  return { error: null }
}) as typeof supabase.rpc

function Fixture() {
  const enabled = !new URLSearchParams(location.search).has('readonly')
  const drag = useCompetitionLineupDrag('fixture-only', source, enabled)
  return <div className="competition-pregame" data-competition-format="singles">
    <section className="competition-pregame__players">
      <p role="status">{drag.message}</p>
      <CompetitionRoster format="singles" sessionId="fixture-only" busyPlayerId={null} disabled={false}
        onAttendance={() => { test.attendance += 1 }} drag={{ ...drag, enabled }}
        players={drag.players.map(player => ({ id: player.id, name: player.guest_name!, avatar: null, status: 'pending' }))} />
    </section>
  </div>
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><ViewportProvider><Fixture /></ViewportProvider></MemoryRouter>)
