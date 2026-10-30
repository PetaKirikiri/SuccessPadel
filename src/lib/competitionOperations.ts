import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { buildDuoStoredSchedule, type DuoTeamInput } from './duoRoundRobinSchedule'
import { solveBalancedSchedule } from './balancedSchedule'
import { buildStoredSchedule, type StoredScheduleRound } from './rankedSchedule'
import { totalScheduleMinutes, type CompetitionScheduleValues } from './competitionScheduleLayout'

/** Operating formats, independent of title, skin, route or viewport. */
export const COMPETITION_OPERATIONS = {
  'rotating-americano': { engine: 'balanced-v11', courts: [1, 2, 3, 4] },
  'fixed-pairs': { engine: 'duo-round-robin-v11', courts: [1, 2, 3, 4] },
  'mixed-americano': { engine: 'mixed-round-robin-v1', courts: [1, 2, 3, 4] },
  'rain': { engine: 'saved-rain-draw-v1', courts: [3, 4] },
} as const
export type CompetitionOperation = keyof typeof COMPETITION_OPERATIONS
export const HALLOWEEN_PLAN = {
  operation: 'mixed-americano' as const, date: '2026-10-31', start: '19:03', end: '21:00',
  players: 16, games: 8, gameMinutes: 12, breakMinutes: 3, courts: [1, 2, 3, 4],
}

export function validateCompetitionWindow(schedule: CompetitionScheduleValues, start: string, end: string) {
  const { games, gameMinutes, breakMinutes } = schedule
  if (!Number.isInteger(games) || games < 1 || games > 20
    || !Number.isInteger(gameMinutes) || gameMinutes < 5 || gameMinutes > 60
    || !Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 30) {
    throw new Error('Explicit game count, game length and break length are required.')
  }
  const available = (Date.parse(end) - Date.parse(start)) / 60000
  if (!Number.isFinite(available) || available < totalScheduleMinutes(games, gameMinutes, breakMinutes)) {
    throw new Error('The complete schedule does not fit. No games were shortened or removed.')
  }
}

/** Fail closed; every round must contain exactly the saved roster once. */
export function validateCompetitionDraw(draw: StoredScheduleRound[], ids: string[], games: number) {
  if (ids.length < 4 || ids.length % 4 || new Set(ids).size !== ids.length
    || ids.some(id => !id || id.startsWith('00000000-0000-4000-8000-'))) {
    throw new Error('Save one real roster slot for every place before creating the draw.')
  }
  if (draw.length !== games) throw new Error('Saved draw does not match the game count. Review competition setup.')
  const allowed = new Set(ids)
  draw.forEach((round, index) => {
    if (round.round !== index + 1 || !Array.isArray(round.matches) || round.matches.length !== ids.length / 4) {
      throw new Error('Saved draw has missing games or courts.')
    }
    const seen = new Set<string>(), courts = new Set<number>()
    for (const match of round.matches) {
      if (!Number.isInteger(match.court) || match.court < 1 || match.court > ids.length / 4 || courts.has(match.court)
        || !Array.isArray(match.team_a) || !Array.isArray(match.team_b) || match.team_a.length !== 2 || match.team_b.length !== 2) {
        throw new Error('Saved draw has an invalid court or team.')
      }
      courts.add(match.court)
      for (const id of [...match.team_a, ...match.team_b]) {
        if (!allowed.has(id) || seen.has(id)) throw new Error('Saved draw has an unknown or duplicated player.')
        seen.add(id)
      }
    }
  })
}

/** The only production dispatcher for constructing a new competition draw. Never called by a reader. */
export function buildCompetitionDraw(input: {
  operation: Exclude<CompetitionOperation, 'rain'>
  roster: CompetitionPlayer[]
  games: number
  seed: number
  teams?: DuoTeamInput[]
  groups?: [string[], string[]]
}): StoredScheduleRound[] {
  const { operation, roster, games, seed } = input
  let draw: StoredScheduleRound[]
  if (operation === 'fixed-pairs') {
    if (!input.teams || input.teams.length * 2 !== roster.length) throw new Error('Save all fixed pairs first.')
    draw = buildDuoStoredSchedule(input.teams, games, seed)
  } else if (operation === 'mixed-americano') {
    const [a, b] = input.groups ?? [[], []]
    if (a.length !== 8 || b.length !== 8 || games !== 8) throw new Error('Mixed rotation requires two explicit groups of eight and eight games.')
    draw = Array.from({ length: games }, (_, round) => {
      const remaining = new Set(a.map((_, i) => i))
      const matches: StoredScheduleRound['matches'] = []
      for (let i = 0; i < a.length; i++) {
        if (!remaining.has(i)) continue
        const opponent = i ^ (round % 7 + 1)
        remaining.delete(i); remaining.delete(opponent)
        matches.push({ court: matches.length + 1, team_a: [a[i], b[(i + round) % 8]], team_b: [a[opponent], b[(opponent + round) % 8]] })
      }
      return { round: round + 1, matches }
    })
  } else if (operation === 'rotating-americano') {
    draw = buildStoredSchedule(roster, solveBalancedSchedule(roster.length, games, seed))
  } else {
    throw new Error('Unsupported competition format. No replacement format was selected.')
  }
  validateCompetitionDraw(draw, roster.map(p => p.id), games)
  return draw
}
