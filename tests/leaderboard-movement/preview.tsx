import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ViewportProvider } from '../../src/contexts/ViewportContext'
import { LocaleProvider } from '../../src/providers/LocaleProvider'
import { AuthProvider } from '../../src/providers/AuthProvider'
import { Leaderboard } from '../../src/components/leaderboard/Leaderboard'
import type { LeaderboardEntry } from '../../src/lib/leaderboardTypes'
import '../../src/index.css'
import './preview.css'

// Synthetic standings only; no competition reads or score persistence.
function Fixture() {
  const format = new URLSearchParams(location.search).get('format') === 'duos' ? 'duos' : 'singles'
  const [step, setStep] = useState(Number(sessionStorage.getItem('movement-fixture-step') ?? 0))
  const names = ['Alex', 'Becky', 'Clemence']
  const entries: LeaderboardEntry[] = names.map((name, i) => ({
    profile_id: (format === 'duos' ? 'duo:' : 'player:') + i,
    display_name: name, total_points: i === 2 && step > 0 ? 8 + step - 1 : 6 - i * 2, games: 1,
    ...(format === 'duos' ? { player_a_id: 'a' + i, player_b_id: 'b' + i, player_a_name: name, player_b_name: 'Partner ' + (i + 1) } : {}),
  })).sort((a, b) => b.total_points - a.total_points)
  return <main className="movement-fixture">
    <button onClick={() => { sessionStorage.setItem('movement-fixture-step', String(step + 1)); setStep(step + 1) }}>Save dummy score</button>
    <button onClick={() => {
      localStorage.removeItem('padel:rank-movement:v1:movement-fixture:' + format)
      sessionStorage.removeItem('movement-fixture-step')
      location.reload()
    }}>Reset fixture</button>
    <Leaderboard entries={entries} competitionId="movement-fixture" competitionFormat={format} compact embedded simpleTeamRows={format === 'duos'} />
  </main>
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><AuthProvider><LocaleProvider><ViewportProvider><Fixture /></ViewportProvider></LocaleProvider></AuthProvider></MemoryRouter>)
