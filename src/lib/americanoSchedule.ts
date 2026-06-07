import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import { courtsNeeded } from './competitionLayout'

type AssignmentRecord = {
  roundNumber: number
  courtIndex: number
  teamA: [string, string]
  teamB: [string, string]
}

export type GameMatch = {
  courtLabel: string
  teamA: [string, string]
  teamB: [string, string]
  teamAPlayers?: [CourtPlayer, CourtPlayer]
  teamBPlayers?: [CourtPlayer, CourtPlayer]
}

export type GameRound = {
  gameNumber: number
  matches: GameMatch[]
}

export type CourtPlayer = {
  id: string | null
  name: string
  avatarUrl: string | null
}

function partnerCount(
  history: AssignmentRecord[],
  beforeRound: number,
  a: string,
  b: string,
): number {
  let count = 0
  for (const r of history) {
    if (r.roundNumber >= beforeRound) continue
    if (
      (r.teamA[0] === a && r.teamA[1] === b) ||
      (r.teamA[0] === b && r.teamA[1] === a) ||
      (r.teamB[0] === a && r.teamB[1] === b) ||
      (r.teamB[0] === b && r.teamB[1] === a)
    ) {
      count += 1
    }
  }
  return count
}

function opponentCount(
  history: AssignmentRecord[],
  beforeRound: number,
  a: string,
  b: string,
): number {
  let count = 0
  for (const r of history) {
    if (r.roundNumber >= beforeRound) continue
    const aOnA = r.teamA[0] === a || r.teamA[1] === a
    const aOnB = r.teamB[0] === a || r.teamB[1] === a
    const bOnA = r.teamA[0] === b || r.teamA[1] === b
    const bOnB = r.teamB[0] === b || r.teamB[1] === b
    if ((aOnA && bOnB) || (aOnB && bOnA)) count += 1
  }
  return count
}

function pairScore(
  history: AssignmentRecord[],
  beforeRound: number,
  a: string,
  b: string,
): number {
  return partnerCount(history, beforeRound, a, b) * 3 + opponentCount(history, beforeRound, a, b)
}

function quadScore(
  history: AssignmentRecord[],
  beforeRound: number,
  e1: string,
  e2: string,
  e3: string,
  e4: string,
): number {
  return (
    pairScore(history, beforeRound, e1, e2) +
    pairScore(history, beforeRound, e1, e3) +
    pairScore(history, beforeRound, e1, e4) +
    pairScore(history, beforeRound, e2, e3) +
    pairScore(history, beforeRound, e2, e4) +
    pairScore(history, beforeRound, e3, e4)
  )
}

function bestTeamSplit(
  history: AssignmentRecord[],
  roundNumber: number,
  e1: string,
  e2: string,
  e3: string,
  e4: string,
): { teamA: [string, string]; teamB: [string, string] } {
  const splits: [[string, string], [string, string]][] = [
    [
      [e1, e2],
      [e3, e4],
    ],
    [
      [e1, e3],
      [e2, e4],
    ],
    [
      [e1, e4],
      [e2, e3],
    ],
  ]

  let bestScore = Number.MAX_SAFE_INTEGER
  let best = splits[0]

  for (const [teamA, teamB] of splits) {
    const score =
      partnerCount(history, roundNumber, teamA[0], teamA[1]) +
      partnerCount(history, roundNumber, teamB[0], teamB[1])
    if (score < bestScore) {
      bestScore = score
      best = [teamA, teamB]
    }
  }

  return { teamA: best[0], teamB: best[1] }
}

function assignAmericanoRound(
  roundNumber: number,
  rosterIds: string[],
  courtCount: number,
  history: AssignmentRecord[],
): AssignmentRecord[] {
  const remaining = [...rosterIds]
  const roundRecords: AssignmentRecord[] = []
  let courtSlot = 0

  while (remaining.length >= 4) {
    const n = remaining.length
    let bestScore = Number.MAX_SAFE_INTEGER
    let bestQuad: string[] | null = null

    for (let i = 0; i < n - 3; i += 1) {
      for (let j = i + 1; j < n - 2; j += 1) {
        for (let k = j + 1; k < n - 1; k += 1) {
          for (let l = k + 1; l < n; l += 1) {
            const e1 = remaining[i]
            const e2 = remaining[j]
            const e3 = remaining[k]
            const e4 = remaining[l]
            const score = quadScore(history, roundNumber, e1, e2, e3, e4)
            if (score < bestScore) {
              bestScore = score
              bestQuad = [e1, e2, e3, e4]
            }
          }
        }
      }
    }

    if (!bestQuad) break

    const [e1, e2, e3, e4] = bestQuad
    const { teamA, teamB } = bestTeamSplit(history, roundNumber, e1, e2, e3, e4)

    courtSlot += 1
    const courtIndex =
      ((courtSlot - 1 + roundNumber - 1) % Math.max(courtCount, 1)) + 1

    roundRecords.push({ roundNumber, courtIndex, teamA, teamB })

    const quadSet = new Set(bestQuad)
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      if (quadSet.has(remaining[i])) remaining.splice(i, 1)
    }
  }

  return roundRecords
}

export function planAmericanoSchedule(
  roster: CompetitionPlayer[],
  courtNames: string[],
  totalGames: number,
): GameRound[] {
  const rosterIds = [...roster].sort((a, b) => a.id.localeCompare(b.id)).map((p) => p.id)
  const nameById = new Map(roster.map((p) => [p.id, rosterDisplayName(p)]))
  const activeCourtCount = courtsNeeded(roster.length)
  const courtsInUse = courtNames.slice(0, activeCourtCount)
  const history: AssignmentRecord[] = []
  const games: GameRound[] = []

  for (let game = 1; game <= totalGames; game += 1) {
    const records = assignAmericanoRound(game, rosterIds, activeCourtCount, history)
    history.push(...records)

    games.push({
      gameNumber: game,
      matches: records.map((r) => ({
        courtLabel: courtsInUse[r.courtIndex - 1] ?? `Court ${r.courtIndex}`,
        teamA: [nameById.get(r.teamA[0]) ?? '?', nameById.get(r.teamA[1]) ?? '?'],
        teamB: [nameById.get(r.teamB[0]) ?? '?', nameById.get(r.teamB[1]) ?? '?'],
      })),
    })
  }

  return games
}
