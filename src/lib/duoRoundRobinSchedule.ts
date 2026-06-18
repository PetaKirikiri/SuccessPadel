import type { StoredScheduleRound } from './rankedSchedule'

export type DuoTeamInput = {
  label: string
  rosterIds: [string, string]
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/** Standard circle round-robin for even team count. */
export function duoRoundRobinRounds(teamCount: number): number[][][] {
  if (teamCount < 2 || teamCount % 2 !== 0) return []
  const fixed = 0
  let rotating = Array.from({ length: teamCount - 1 }, (_, i) => i + 1)
  const rounds: number[][][] = []

  for (let r = 0; r < teamCount - 1; r += 1) {
    const order = [fixed, ...rotating]
    const round: number[][] = []
    for (let i = 0; i < teamCount / 2; i += 1) {
      round.push([order[i], order[teamCount - 1 - i]])
    }
    rounds.push(round)
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)]
  }
  return rounds
}

function rematchRound(priorRounds: number[][][], teamCount: number, seed: number): number[][] {
  const counts = new Map<string, number>()
  for (const round of priorRounds) {
    for (const [a, b] of round) {
      const key = pairKey(a, b)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  const pairs: number[][] = []
  for (let i = 0; i < teamCount; i += 1) {
    for (let j = i + 1; j < teamCount; j += 1) {
      pairs.push([i, j])
    }
  }

  pairs.sort((p1, p2) => {
    const c1 = counts.get(pairKey(p1[0], p1[1])) ?? 0
    const c2 = counts.get(pairKey(p2[0], p2[1])) ?? 0
    if (c1 !== c2) return c1 - c2
    const h1 = (p1[0] * 17 + p1[1] * 31 + seed) % 997
    const h2 = (p2[0] * 17 + p2[1] * 31 + seed) % 997
    return h1 - h2
  })

  const used = new Set<number>()
  const selected: number[][] = []
  for (const pair of pairs) {
    if (used.has(pair[0]) || used.has(pair[1])) continue
    selected.push(pair)
    used.add(pair[0])
    used.add(pair[1])
    if (selected.length === teamCount / 2) break
  }
  return selected
}

export function solveDuoSchedule(
  teams: DuoTeamInput[],
  gameCount: number,
  seed = 0,
): StoredScheduleRound[] {
  if (teams.length < 2 || teams.length % 2 !== 0) return []

  const rr = duoRoundRobinRounds(teams.length)
  const rounds: number[][][] = [...rr]

  while (rounds.length < gameCount) {
    rounds.push(rematchRound(rounds, teams.length, seed + rounds.length))
  }

  return rounds.slice(0, gameCount).map((round, index) => ({
    round: index + 1,
    matches: round.map(([teamA, teamB], courtIndex) => ({
      court: courtIndex + 1,
      team_a: teams[teamA].rosterIds,
      team_b: teams[teamB].rosterIds,
    })),
  }))
}

export function buildDuoStoredSchedule(
  teams: DuoTeamInput[],
  gameCount: number,
  seed = 0,
): StoredScheduleRound[] {
  return solveDuoSchedule(teams, gameCount, seed)
}
