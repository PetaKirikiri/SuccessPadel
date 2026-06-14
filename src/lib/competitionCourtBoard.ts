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

/** Numeric key from labels like "Court 1" — unknown labels sort last. */
export function courtLabelSortKey(label: string): number {
  const match = /^Court\s*(\d+)$/i.exec(label.trim())
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

export function compareCourtLabels(a: string, b: string): number {
  const keyDiff = courtLabelSortKey(a) - courtLabelSortKey(b)
  return keyDiff !== 0 ? keyDiff : a.localeCompare(b)
}

export function sortMatchesByCourtLabel<T extends { courtLabel: string }>(matches: T[]): T[] {
  return [...matches].sort((a, b) => compareCourtLabels(a.courtLabel, b.courtLabel))
}

export function sortGameRoundsByCourt(games: GameRound[]): GameRound[] {
  return games.map((game) => ({
    ...game,
    matches: sortMatchesByCourtLabel(game.matches),
  }))
}

export function sortLiveCourtsByClubOrder<
  T extends { courtId: string; courtName: string },
>(courts: T[], sortOrderByCourtId: Map<string, number>): T[] {
  return [...courts].sort(
    (a, b) =>
      (sortOrderByCourtId.get(a.courtId) ?? courtLabelSortKey(a.courtName)) -
      (sortOrderByCourtId.get(b.courtId) ?? courtLabelSortKey(b.courtName)),
  )
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

export function formatGameTimeLabel(startsAtMs: number, endsAtMs: number): string {
  return `${formatClubTime(new Date(startsAtMs))}–${formatClubTime(new Date(endsAtMs))}`
}

export function pivotScheduleByCourt(
  games: GameRound[],
  eventStartsAt: string | undefined,
  gameMinutes: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
  eventEndsAt?: string,
): CourtColumn[] {
  const map = new Map<string, CourtColumn>()
  const order: string[] = []
  const eventEndMs = eventEndsAt ? new Date(eventEndsAt).getTime() : null

  for (const game of games) {
    const slot = eventStartsAt
      ? gameSlotTimes(eventStartsAt, game.gameNumber, gameMinutes, breakMinutes)
      : null
    let timeLabel = ''
    if (slot) {
      const endsAtMs =
        eventEndMs != null ? Math.min(slot.endsAt.getTime(), eventEndMs) : slot.endsAt.getTime()
      timeLabel = formatGameTimeLabel(slot.startsAt.getTime(), endsAtMs)
    }

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

  return order.sort(compareCourtLabels).map((label) => map.get(label)!)
}
