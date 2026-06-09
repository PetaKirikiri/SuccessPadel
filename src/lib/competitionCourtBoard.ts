import type { CourtPlayer, GameRound } from './americanoSchedule'
import { COMPETITION_BREAK_MINUTES, gameSlotTimes } from './competitionLayout'
import { formatClubTime } from './courtSchedule'

export type CourtGameCell = {
  gameNumber: number
  timeLabel: string
  teamA: [string, string]
  teamB: [string, string]
  teamAPlayers?: [CourtPlayer, CourtPlayer]
  teamBPlayers?: [CourtPlayer, CourtPlayer]
}

export type CourtColumn = {
  courtLabel: string
  cells: CourtGameCell[]
}

export type GameRow = {
  gameNumber: number
  timeLabel: string
  courts: (CourtGameCell & { courtLabel: string })[]
}

export function pivotScheduleByGame(columns: CourtColumn[]): GameRow[] {
  const gameNumbers = columns[0]?.cells.map((c) => c.gameNumber) ?? []
  return gameNumbers.map((gameNumber) => ({
    gameNumber,
    timeLabel: columns[0]?.cells.find((c) => c.gameNumber === gameNumber)?.timeLabel ?? '',
    courts: columns
      .map((col) => {
        const cell = col.cells.find((c) => c.gameNumber === gameNumber)
        if (!cell) return null
        return { courtLabel: col.courtLabel, ...cell }
      })
      .filter((c): c is CourtGameCell & { courtLabel: string } => c != null),
  }))
}

export function pivotScheduleByCourt(
  games: GameRound[],
  eventStartsAt: string | undefined,
  gameMinutes: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
): CourtColumn[] {
  const map = new Map<string, CourtColumn>()
  const order: string[] = []

  for (const game of games) {
    const slot = eventStartsAt
      ? gameSlotTimes(eventStartsAt, game.gameNumber, gameMinutes, breakMinutes)
      : null
    const timeLabel = slot
      ? `${formatClubTime(slot.startsAt)}–${formatClubTime(slot.endsAt)}`
      : ''

    for (const match of game.matches) {
      if (!map.has(match.courtLabel)) {
        map.set(match.courtLabel, { courtLabel: match.courtLabel, cells: [] })
        order.push(match.courtLabel)
      }
      map.get(match.courtLabel)!.cells.push({
        gameNumber: game.gameNumber,
        timeLabel,
        teamA: match.teamA,
        teamB: match.teamB,
        teamAPlayers: match.teamAPlayers,
        teamBPlayers: match.teamBPlayers,
      })
    }
  }

  return order.map((label) => map.get(label)!)
}
