import { buildCompetitionDraw, HALLOWEEN_PLAN } from './competitionOperations'
import type { CompetitionPlayer } from '../hooks/useCompetitions'
export const halloweenPlayers = ['Poom', 'มะม่วง', 'Dave', 'พี่มิก', 'Benz', '', '', '', 'Aew', "P’Nee", 'หมอไปร๋', 'พี่ตั๊ก', 'พี่ธิดา', '', '', '']

// The announcement and saved event use the same mixed-format engine and timing recipe.
const ids = halloweenPlayers.map((_, i) => `slot-${i}`)
const draw = buildCompetitionDraw({ operation: HALLOWEEN_PLAN.operation,
  roster: ids.map(id => ({ id })) as CompetitionPlayer[], games: HALLOWEEN_PLAN.games,
  seed: 0, groups: [ids.slice(0, 8), ids.slice(8)] })
export const halloweenRounds = draw.map(round => {
  const [hour, minute] = HALLOWEEN_PLAN.start.split(':').map(Number)
  const start = hour * 60 + minute + (round.round - 1) * (HALLOWEEN_PLAN.gameMinutes + HALLOWEEN_PLAN.breakMinutes)
  const clock = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  return { number: round.round, start: clock(start), end: clock(start + HALLOWEEN_PLAN.gameMinutes),
    courts: round.matches.map(m => [...m.team_a, ...m.team_b].map(id => ids.indexOf(id)) as [number,number,number,number]) }
})
