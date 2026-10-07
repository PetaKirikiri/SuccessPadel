import type { CourtPlayer } from '../../lib/americanoSchedule'
import type { GameRow } from '../../lib/competitionCourtBoard'

export const RAIN_START_MINUTES = 18 * 60 + 15
export const RAIN_GAME_MINUTES = 10
export const RAIN_CHANGEOVER_SECONDS = 105
export const RAIN_ROUNDS = 9

export type RainRound = {
  game: GameRow
  resting: CourtPlayer[]
  startsAt: string
  endsAt: string
}

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return seconds % 60 ? `${label}:${String(seconds % 60).padStart(2, '0')}` : label
}

/** Local demonstration only. Does not read or persist competition rounds or scores. */
export function buildRainSchedule(players: CourtPlayer[]): RainRound[] {
  if (players.length !== 12 || new Set(players.map(p => p.rosterId)).size !== 12 || players.some(p => !p.rosterId)) {
    throw new Error('This rotation needs exactly 12 distinct players: eight playing and four resting.')
  }
  const groups = [players.slice(0, 4), players.slice(4, 8), players.slice(8, 12)]
  return Array.from({ length: RAIN_ROUNDS }, (_, round) => {
    const restingGroup = (round + 2) % 3
    const active = groups.filter((_, index) => index !== restingGroup)
    const shift = Math.floor(round / 3)
    const pairs: [CourtPlayer, CourtPlayer][] = active[0]!.map((player, index) => [player, active[1]![(index + shift) % 4]!])
    const startSeconds = RAIN_START_MINUTES * 60 + round * (RAIN_GAME_MINUTES * 60 + RAIN_CHANGEOVER_SECONDS)
    const startsAt = clock(startSeconds)
    const endsAt = clock(startSeconds + RAIN_GAME_MINUTES * 60)
    const timeLabel = `${startsAt}–${endsAt}`
    const gameNumber = round + 1
    return {
      startsAt, endsAt,
      resting: groups[restingGroup]!,
      game: {
        gameNumber, timeLabel,
        courts: [0, 1].map(court => {
          const pairIndex = ((court + shift) % 2) * 2
          const teamAPlayers = pairs[pairIndex]!
          const teamBPlayers = pairs[pairIndex + 1]!
          return {
            gameNumber, timeLabel, courtLabel: `Court ${court + 3}`,
            teamA: [teamAPlayers[0].name, teamAPlayers[1].name],
            teamB: [teamBPlayers[0].name, teamBPlayers[1].name],
            teamAPlayers, teamBPlayers,
          }
        }),
      },
    }
  })
}
