import type { CourtPlayer } from './americanoSchedule'
import type { Quadrant } from './gestureCapture'
import type { QuadrantPlayers } from './gesturePadPlayers'
import type { TennisScore } from './tennisScore'

export type CourtTeam = 'a' | 'b'
export type CourtHalf = 'left' | 'right'
export type SetupPhase = 'positions' | 'serve' | 'ready'

export type TeamPair = [CourtPlayer, CourtPlayer]

export function teamsFromQuadrants(players: QuadrantPlayers): {
  teamA: TeamPair
  teamB: TeamPair
} {
  return {
    teamA: [
      players.TL ?? { id: null, name: '', avatarUrl: null },
      players.TR ?? { id: null, name: '', avatarUrl: null },
    ],
    teamB: [
      players.BL ?? { id: null, name: '', avatarUrl: null },
      players.BR ?? { id: null, name: '', avatarUrl: null },
    ],
  }
}

export function teamIsPlaced(team: CourtTeam, assignments: Partial<QuadrantPlayers>): boolean {
  if (team === 'a') return Boolean(assignments.TL?.name?.trim() && assignments.TR?.name?.trim())
  return Boolean(assignments.BL?.name?.trim() && assignments.BR?.name?.trim())
}

export function dropHalfFromX(clientX: number, rect: DOMRect): CourtHalf {
  return clientX - rect.left < rect.width / 2 ? 'left' : 'right'
}

export function quadrantHalf(q: Quadrant): CourtHalf {
  return q === 'TL' || q === 'BL' ? 'left' : 'right'
}

export function teamForQuadrant(q: Quadrant): CourtTeam {
  return q === 'TL' || q === 'TR' ? 'a' : 'b'
}

/** First server from a left/right half tap (top vs bottom by Y). */
export function serverQuadrantFromHalfTap(
  half: CourtHalf,
  clientY: number,
  rect: DOMRect,
): Quadrant {
  const top = clientY < rect.top + rect.height / 2
  if (half === 'left') return top ? 'TL' : 'BL'
  return top ? 'TR' : 'BR'
}

export function quadrantsForTeamPlacement(
  team: CourtTeam,
  half: CourtHalf,
  draggedPlayer: CourtPlayer,
  teamPair: TeamPair,
): Partial<QuadrantPlayers> {
  const draggedIdx = teamPair.findIndex((p) => playerKey(p) === playerKey(draggedPlayer))
  const partner = teamPair[draggedIdx === 0 ? 1 : 0]!
  const dragged = draggedPlayer
  const other = partner

  if (team === 'a') {
    return half === 'left' ? { TL: dragged, TR: other } : { TL: other, TR: dragged }
  }
  return half === 'left' ? { BL: dragged, BR: other } : { BL: other, BR: dragged }
}

export const COURT_QUADRANTS: Quadrant[] = ['TL', 'TR', 'BL', 'BR']

export function playerKey(player: CourtPlayer): string {
  return (player.id ?? player.name.trim()).toLowerCase()
}

export function rosterFromQuadrants(players: QuadrantPlayers): CourtPlayer[] {
  const seen = new Set<string>()
  const roster: CourtPlayer[] = []
  for (const quadrant of COURT_QUADRANTS) {
    const player = players[quadrant]
    if (!player?.name?.trim()) continue
    const key = playerKey(player)
    if (seen.has(key)) continue
    seen.add(key)
    roster.push(player)
  }
  return roster
}

export function isCompleteAssignment(
  roster: CourtPlayer[],
  assignments: Partial<QuadrantPlayers>,
): boolean {
  if (roster.length < 4) return false
  const rosterKeys = new Set(roster.map(playerKey))
  const assignedKeys = new Set<string>()
  for (const quadrant of COURT_QUADRANTS) {
    const player = assignments[quadrant]
    if (!player?.name?.trim()) return false
    assignedKeys.add(playerKey(player))
  }
  if (assignedKeys.size !== 4) return false
  return [...assignedKeys].every((key) => rosterKeys.has(key))
}

export function courtSetupStorageKey(
  competitionId: string,
  gameNumber: string,
  courtId: string,
): string {
  return `sp-court-pos-${competitionId}-${gameNumber}-${courtId}`
}

type StoredPlayer = { id: string | null; name: string; avatarUrl: string | null }

type StoredCourtSetup = {
  positions: Record<Quadrant, StoredPlayer>
  serveQuadrant?: Quadrant
  score?: TennisScore
  matchSubmitted?: boolean
  matchStartedAt?: string
}

function serialize(assignments: QuadrantPlayers): Record<Quadrant, StoredPlayer> {
  return COURT_QUADRANTS.reduce(
    (acc, q) => {
      const p = assignments[q]!
      acc[q] = { id: p.id, name: p.name, avatarUrl: p.avatarUrl }
      return acc
    },
    {} as Record<Quadrant, StoredPlayer>,
  )
}

function deserialize(raw: Record<Quadrant, StoredPlayer>): QuadrantPlayers {
  const out: QuadrantPlayers = {}
  for (const q of COURT_QUADRANTS) {
    const p = raw[q]
    if (p?.name?.trim()) {
      out[q] = { id: p.id, name: p.name, avatarUrl: p.avatarUrl }
    }
  }
  return out
}

export function loadCourtSetup(
  key: string,
  roster: CourtPlayer[],
): { assignments: QuadrantPlayers; serveQuadrant: Quadrant | null; score: TennisScore | null; matchSubmitted: boolean; matchStartedAt: string | null } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredCourtSetup | Record<Quadrant, StoredPlayer>
    const positions =
      'positions' in parsed ? parsed.positions : (parsed as Record<Quadrant, StoredPlayer>)
    const assignments = deserialize(positions)
    if (!isCompleteAssignment(roster, assignments)) return null
    const serveQuadrant =
      'serveQuadrant' in parsed && parsed.serveQuadrant ? parsed.serveQuadrant : null
    const score =
      'score' in parsed && parsed.score
        ? parsed.score
        : null
    const matchSubmitted = Boolean('matchSubmitted' in parsed && parsed.matchSubmitted)
    const matchStartedAt =
      'matchStartedAt' in parsed && parsed.matchStartedAt ? parsed.matchStartedAt : null
    return {
      assignments: assignments as QuadrantPlayers,
      serveQuadrant,
      score,
      matchSubmitted,
      matchStartedAt,
    }
  } catch {
    return null
  }
}

/** @deprecated use loadCourtSetup */
export function loadCourtPositions(
  key: string,
  roster: CourtPlayer[],
): Partial<QuadrantPlayers> | null {
  const setup = loadCourtSetup(key, roster)
  return setup?.assignments ?? null
}

export function saveCourtSetup(
  key: string,
  assignments: QuadrantPlayers,
  serveQuadrant: Quadrant,
  score?: TennisScore,
  matchSubmitted?: boolean,
  matchStartedAt?: string,
): void {
  try {
    const payload: StoredCourtSetup = {
      positions: serialize(assignments),
      serveQuadrant,
      ...(score ? { score } : {}),
      ...(matchSubmitted ? { matchSubmitted: true } : {}),
      ...(matchStartedAt ? { matchStartedAt } : {}),
    }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function saveCourtPositions(key: string, assignments: QuadrantPlayers): void {
  try {
    localStorage.setItem(key, JSON.stringify(serialize(assignments)))
  } catch {
    /* ignore */
  }
}

export function clearCourtPositions(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function availablePlayersForSlot(
  roster: CourtPlayer[],
  assignments: Partial<QuadrantPlayers>,
  slot: Quadrant,
): CourtPlayer[] {
  const taken = new Set(
    COURT_QUADRANTS.filter((q) => q !== slot && assignments[q])
      .map((q) => playerKey(assignments[q]!)),
  )
  const current = assignments[slot]
  return roster.filter((p) => {
    const key = playerKey(p)
    if (current && playerKey(current) === key) return true
    return !taken.has(key)
  })
}
