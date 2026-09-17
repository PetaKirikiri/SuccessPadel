import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ViewportProvider } from '../../src/contexts/ViewportContext'
import { CompetitionRoster } from '../../src/components/competition-formats/CompetitionRoster'
import type { AttendancePlayer, AttendanceStatus } from '../../src/components/competition-formats/rosterContract'
import '../../src/index.css'

// Local-only, deterministic fixture. No real roster/session IDs or save calls.
const names = ['Malaka', 'Calou', 'Dave', 'Josh', 'Tak', 'Soren', 'Jeff', "P’Thida", 'Kitt', 'Pai', 'Annie', 'Nee', 'Olivier', 'Marius', 'Bert', 'Mathias']
function Fixture() {
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
  const format = new URLSearchParams(location.search).get('format') === 'singles' ? 'singles' : 'duos'
  const players: AttendancePlayer[] = names.map((name, index) => ({ id: `fixture-${index}`, name, avatar: null, status: attendance[`fixture-${index}`] ?? 'pending' }))
  const controls = { sessionId: 'fixture-only', busyPlayerId: null, disabled: false, onAttendance: (id: string, status: AttendanceStatus) => setAttendance(current => ({ ...current, [id]: status })) }
  const noop = () => {}
  return <div className="competition-pregame" data-competition-format={format}>
    <section className="competition-pregame__players">
      {format === 'duos' ? <CompetitionRoster format="duos" {...controls} teams={Array.from({ length: 8 }, (_, n) => [players[n * 2]!, players[n * 2 + 1]!])} /> :
        <CompetitionRoster format="singles" {...controls} players={players} drag={{ enabled: false, saving: false, targetId: null, draggingId: null, pointerDown: noop, pointerMove: noop, pointerUp: noop, cancel: noop, keyDown: noop }} />}
    </section>
  </div>
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><ViewportProvider><Fixture /></ViewportProvider></MemoryRouter>)
