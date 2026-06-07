import type { GameRound } from './americanoSchedule'
import { formatMatchup } from './debug/competitionScheduleDebug'

export type LiveCourtRow = {
  courtName: string
  teamA: string[]
  teamB: string[]
}

export type ScheduleCompareRow = {
  gameNumber: number
  courtName: string
  db: string | null
  preview: string | null
  same: boolean
}

export type ScheduleCompareSummary = {
  rows: ScheduleCompareRow[]
  dbGamesWithData: number
  dbCourt1Unique: number
  previewCourt1Unique: number
  duplicateDbCourt1: number[]
  mismatches: ScheduleCompareRow[]
  court1Preview: string[]
  court1Db: string[]
}

function previewByGameCourt(games: GameRound[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const game of games) {
    for (const match of game.matches) {
      map.set(`${game.gameNumber}:${match.courtLabel}`, formatMatchup(match.teamA, match.teamB))
    }
  }
  return map
}

export function compareSchedules(
  liveCourtsByGame: Map<number, LiveCourtRow[]>,
  americanoGames: GameRound[],
): ScheduleCompareSummary {
  const preview = previewByGameCourt(americanoGames)
  const rows: ScheduleCompareRow[] = []

  const gameNumbers = new Set([
    ...liveCourtsByGame.keys(),
    ...americanoGames.map((g) => g.gameNumber),
  ])

  for (const gameNumber of [...gameNumbers].sort((a, b) => a - b)) {
    const courts = liveCourtsByGame.get(gameNumber) ?? []
    const courtNames = new Set([
      ...courts.map((c) => c.courtName),
      ...(americanoGames.find((g) => g.gameNumber === gameNumber)?.matches.map((m) => m.courtLabel) ??
        []),
    ])

    for (const courtName of [...courtNames].sort()) {
      const live = courts.find((c) => c.courtName === courtName)
      const db = live ? formatMatchup(live.teamA, live.teamB) : null
      const prev = preview.get(`${gameNumber}:${courtName}`) ?? null
      rows.push({
        gameNumber,
        courtName,
        db,
        preview: prev,
        same: db != null && prev != null && db === prev,
      })
    }
  }

  const court1Label = americanoGames[0]?.matches[0]?.courtLabel
  const court1Preview = americanoGames.map((g) => {
    const m = g.matches.find((x) => x.courtLabel === court1Label) ?? g.matches[0]
    return m ? formatMatchup(m.teamA, m.teamB) : ''
  })

  const court1Db: string[] = []
  for (const gameNumber of [...gameNumbers].sort((a, b) => a - b)) {
    const courts = liveCourtsByGame.get(gameNumber) ?? []
    const live =
      (court1Label ? courts.find((c) => c.courtName === court1Label) : null) ?? courts[0]
    court1Db.push(live ? formatMatchup(live.teamA, live.teamB) : '')
  }

  const seen = new Map<string, number>()
  const duplicateDbCourt1: number[] = []
  court1Db.forEach((m, i) => {
    if (!m) return
    if (seen.has(m)) duplicateDbCourt1.push(i + 1)
    else seen.set(m, i + 1)
  })

  const mismatches = rows.filter((r) => r.db && r.preview && !r.same)

  return {
    rows,
    dbGamesWithData: liveCourtsByGame.size,
    dbCourt1Unique: new Set(court1Db.filter(Boolean)).size,
    previewCourt1Unique: new Set(court1Preview.filter(Boolean)).size,
    duplicateDbCourt1,
    mismatches,
    court1Preview,
    court1Db,
  }
}
