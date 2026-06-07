/** Balanced doubles: no repeat partners, spread opponents, no exact-match repeats, team totals ≈ equal. */

export type PlayerSlot = number

export type CourtAssignment = {
  teamA: [PlayerSlot, PlayerSlot]
  teamB: [PlayerSlot, PlayerSlot]
  balanceDiff: number
}

export type RoundAssignment = {
  round: number
  courts: CourtAssignment[]
}

export type ScheduleQuality = {
  rounds: number
  playerCount: number
  repeatPartners: number
  maxPartnerCount: number
  avgBalanceDiff: number
  maxBalanceDiff: number
  repeatOpponentQuads: number
  maxOpponentMeetings: number
  repeatExactMatches: number
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function pairKey(a: PlayerSlot, b: PlayerSlot): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function teamPair(a: PlayerSlot, b: PlayerSlot): [PlayerSlot, PlayerSlot] {
  return a < b ? [a, b] : [b, a]
}

function matchKey(
  teamA: [PlayerSlot, PlayerSlot],
  teamB: [PlayerSlot, PlayerSlot],
): string {
  const ka = pairKey(teamA[0], teamA[1])
  const kb = pairKey(teamB[0], teamB[1])
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
}

function splitsOfFour(
  four: PlayerSlot[],
  ranks: number[],
): CourtAssignment[] {
  const [a, b, c, d] = four
  const opts: [[PlayerSlot, PlayerSlot], [PlayerSlot, PlayerSlot]][] = [
    [
      [a, b],
      [c, d],
    ],
    [
      [a, c],
      [b, d],
    ],
    [
      [a, d],
      [b, c],
    ],
  ]
  return opts.map(([ta, tb]) => {
    const sumA = ranks[ta[0]] + ranks[ta[1]]
    const sumB = ranks[tb[0]] + ranks[tb[1]]
    return {
      teamA: teamPair(ta[0], ta[1]),
      teamB: teamPair(tb[0], tb[1]),
      balanceDiff: Math.abs(sumA - sumB),
    }
  })
}

function buildRound(
  pool: PlayerSlot[],
  ranks: number[],
  usedPartners: Set<string>,
  usedMatches: Set<string>,
  opponentCounts: Map<string, number>,
): CourtAssignment[] {
  const courts: CourtAssignment[] = []
  let remaining = [...pool]

  while (remaining.length >= 4) {
    const anchor = remaining[0]
    const rest = remaining.slice(1)
    let best: CourtAssignment | null = null
    let bestScore = Number.MAX_SAFE_INTEGER

    for (let i = 0; i < rest.length - 2; i += 1) {
      for (let j = i + 1; j < rest.length - 1; j += 1) {
        for (let k = j + 1; k < rest.length; k += 1) {
          const four = [anchor, rest[i], rest[j], rest[k]]
          for (const court of splitsOfFour(four, ranks)) {
            const pkA = pairKey(court.teamA[0], court.teamA[1])
            const pkB = pairKey(court.teamB[0], court.teamB[1])
            const repeatPartner =
              (usedPartners.has(pkA) ? 1 : 0) + (usedPartners.has(pkB) ? 1 : 0)
            const repeatMatch = usedMatches.has(matchKey(court.teamA, court.teamB)) ? 1 : 0
            let repeatOpponents = 0
            let oppPenalty = 0
            for (const p of court.teamA) {
              for (const q of court.teamB) {
                const prev = opponentCounts.get(pairKey(p, q)) ?? 0
                if (prev > 0) repeatOpponents += 1
                oppPenalty += prev * prev
              }
            }
            const score =
              repeatPartner * 1_000_000 +
              repeatMatch * 100_000 +
              repeatOpponents * 80_000 +
              court.balanceDiff * 100 +
              oppPenalty * 2_000
            if (score < bestScore) {
              bestScore = score
              best = court
            }
          }
        }
      }
    }

    if (!best) break
    courts.push(best)
    const chosen = new Set([best.teamA[0], best.teamA[1], best.teamB[0], best.teamB[1]])
    remaining = remaining.filter((p) => !chosen.has(p))
  }

  return courts
}

function commitRound(
  courts: CourtAssignment[],
  usedPartners: Set<string>,
  usedMatches: Set<string>,
  opponentCounts: Map<string, number>,
): void {
  for (const court of courts) {
    usedPartners.add(pairKey(court.teamA[0], court.teamA[1]))
    usedPartners.add(pairKey(court.teamB[0], court.teamB[1]))
    usedMatches.add(matchKey(court.teamA, court.teamB))
    for (const p of court.teamA) {
      for (const q of court.teamB) {
        const key = pairKey(p, q)
        opponentCounts.set(key, (opponentCounts.get(key) ?? 0) + 1)
      }
    }
  }
}

function attemptSchedule(
  playerCount: number,
  ranks: number[],
  totalRounds: number,
  rng: () => number,
): RoundAssignment[] {
  const usedPartners = new Set<string>()
  const usedMatches = new Set<string>()
  const opponentCounts = new Map<string, number>()
  const rounds: RoundAssignment[] = []
  const base = Array.from({ length: playerCount }, (_, i) => i)

  for (let g = 0; g < totalRounds; g += 1) {
    const pool = shuffle(base, rng)
    const courts = buildRound(pool, ranks, usedPartners, usedMatches, opponentCounts)
    if (courts.length === 0) break
    commitRound(courts, usedPartners, usedMatches, opponentCounts)
    rounds.push({ round: g + 1, courts })
  }

  return rounds
}

function scoreSchedule(
  schedule: RoundAssignment[],
  playerCount: number,
  totalRounds: number,
): number {
  const q = measureScheduleQuality(schedule, playerCount)
  const missing = Math.max(0, totalRounds - schedule.length)
  const excessOpponentMeetings = Math.max(0, q.maxOpponentMeetings - 2)
  return (
    missing * 10_000_000 +
    q.repeatPartners * 1_000_000 +
    q.repeatExactMatches * 100_000 +
    excessOpponentMeetings * 50_000 +
    q.maxOpponentMeetings * 5_000 +
    q.repeatOpponentQuads * 500 +
    q.maxBalanceDiff * 300 +
    Math.round(q.avgBalanceDiff * 20)
  )
}

export function solveBalancedSchedule(
  playerCount: number,
  totalRounds: number,
  scheduleSeed = 0,
): RoundAssignment[] {
  if (playerCount < 4 || playerCount % 4 !== 0) return []

  const ranks = Array.from({ length: playerCount }, (_, i) => i + 1)
  const restarts = 200
  let best: RoundAssignment[] | null = null
  let bestScore = Number.MAX_SAFE_INTEGER

  for (let r = 0; r < restarts; r += 1) {
    const rng = mulberry32((scheduleSeed + 1) * 7919 + r * 104729)
    const schedule = attemptSchedule(playerCount, ranks, totalRounds, rng)
    const score = scoreSchedule(schedule, playerCount, totalRounds)
    if (score < bestScore) {
      bestScore = score
      best = schedule
      if (score === 0) break
    }
  }

  return best ?? []
}

export function measureScheduleQuality(
  schedule: RoundAssignment[],
  playerCount: number,
): ScheduleQuality {
  const partnerCounts = new Map<string, number>()
  const opponentCounts = new Map<string, number>()
  const matchCounts = new Map<string, number>()
  let balanceSum = 0
  let maxBalance = 0

  for (const round of schedule) {
    for (const court of round.courts) {
      balanceSum += court.balanceDiff
      maxBalance = Math.max(maxBalance, court.balanceDiff)
      for (const pair of [court.teamA, court.teamB]) {
        const key = pairKey(pair[0], pair[1])
        partnerCounts.set(key, (partnerCounts.get(key) ?? 0) + 1)
      }
      const mk = matchKey(court.teamA, court.teamB)
      matchCounts.set(mk, (matchCounts.get(mk) ?? 0) + 1)
      for (const p of court.teamA) {
        for (const q of court.teamB) {
          const key = pairKey(p, q)
          opponentCounts.set(key, (opponentCounts.get(key) ?? 0) + 1)
        }
      }
    }
  }

  let repeatPartners = 0
  let maxPartnerCount = 0
  for (const count of partnerCounts.values()) {
    maxPartnerCount = Math.max(maxPartnerCount, count)
    if (count > 1) repeatPartners += count - 1
  }

  let repeatOpponentQuads = 0
  let maxOpponentMeetings = 0
  for (const count of opponentCounts.values()) {
    maxOpponentMeetings = Math.max(maxOpponentMeetings, count)
    if (count > 1) repeatOpponentQuads += 1
  }

  let repeatExactMatches = 0
  for (const count of matchCounts.values()) {
    if (count > 1) repeatExactMatches += count - 1
  }

  const matchCount = schedule.reduce((s, r) => s + r.courts.length, 0)

  return {
    rounds: schedule.length,
    playerCount,
    repeatPartners,
    maxPartnerCount,
    avgBalanceDiff: matchCount > 0 ? balanceSum / matchCount : 0,
    maxBalanceDiff: maxBalance,
    repeatOpponentQuads,
    maxOpponentMeetings,
    repeatExactMatches,
  }
}

export type ScheduleRepeatPair = {
  slotA: PlayerSlot
  slotB: PlayerSlot
  times: number
}

function parsePairKey(key: string): [PlayerSlot, PlayerSlot] {
  const [a, b] = key.split(':').map((n) => Number(n))
  return [a, b]
}

function repeatsFromCounts(counts: Map<string, number>): ScheduleRepeatPair[] {
  const out: ScheduleRepeatPair[] = []
  for (const [key, times] of counts) {
    if (times <= 1) continue
    const [slotA, slotB] = parsePairKey(key)
    out.push({ slotA, slotB, times })
  }
  return out.sort((a, b) => b.times - a.times || a.slotA - b.slotA || a.slotB - b.slotB)
}

export function listScheduleRepeats(schedule: RoundAssignment[]): {
  partners: ScheduleRepeatPair[]
  opponents: ScheduleRepeatPair[]
} {
  const partnerCounts = new Map<string, number>()
  const opponentCounts = new Map<string, number>()

  for (const round of schedule) {
    for (const court of round.courts) {
      for (const pair of [court.teamA, court.teamB]) {
        const key = pairKey(pair[0], pair[1])
        partnerCounts.set(key, (partnerCounts.get(key) ?? 0) + 1)
      }
      for (const p of court.teamA) {
        for (const q of court.teamB) {
          const key = pairKey(p, q)
          opponentCounts.set(key, (opponentCounts.get(key) ?? 0) + 1)
        }
      }
    }
  }

  return {
    partners: repeatsFromCounts(partnerCounts),
    opponents: repeatsFromCounts(opponentCounts),
  }
}
