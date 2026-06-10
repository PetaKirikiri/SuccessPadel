import type { CourtPlayer } from './americanoSchedule'
import { logStateIngest } from './matchCourtStateDebug'
import { agentDebugIngest } from './debug/devDebug'
import {
  persistValidatedSetupState,
  recoverSetupState,
  validateSetupState,
  validatedStateToLoaded,
} from './matchSetupStateValidate'
import type { GameLogSetupState } from './gameLogSetupState'
import type { SetupLogEntry } from './matchSetupLog'
import type { Quadrant } from './gestureCapture'
import type { QuadrantPlayers } from './gesturePadPlayers'
import type { TennisScore } from './tennisScore'
import { quadrantTeam } from './gestureScoring'
import { rightQuadrantForTeam } from './serveRotation'

export type CourtTeam = 'a' | 'b'
export type CourtHalf = 'left' | 'right'
export type SetupPhase = 'positions' | 'serve' | 'confirm_serve' | 'ready'

export type TeamPair = [CourtPlayer, CourtPlayer]

/** Team pairs from session order (players 0–1 vs 2–3), not quadrant layout. */
export function teamsFromSessionRoster(roster: CourtPlayer[]): {
  teamA: TeamPair
  teamB: TeamPair
} | null {
  if (roster.length < 4) return null
  return {
    teamA: [roster[0]!, roster[1]!],
    teamB: [roster[2]!, roster[3]!],
  }
}

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

/** Keep only fully placed teams — single-quadrant slots are corrupt during positions. */
export function stripIncompleteTeamAssignments(
  assignments: Partial<QuadrantPlayers>,
): Partial<QuadrantPlayers> {
  const out: Partial<QuadrantPlayers> = {}
  for (const team of ['a', 'b'] as CourtTeam[]) {
    if (!teamIsPlaced(team, assignments)) continue
    for (const q of quadrantsForTeam(team)) {
      const player = assignments[q]
      if (player?.name?.trim()) out[q] = player
    }
  }
  return out
}

export function dropHalfFromX(clientX: number, rect: DOMRect): CourtHalf {
  return clientX - rect.left < rect.width / 2 ? 'left' : 'right'
}

export function dropHalfFromClient(
  clientX: number,
  _clientY: number,
  pad: HTMLElement,
): CourtHalf {
  return dropHalfFromX(clientX, pad.getBoundingClientRect())
}

export function quadrantHalf(q: Quadrant): CourtHalf {
  return q === 'TL' || q === 'BL' ? 'left' : 'right'
}

export type CourtPerspective = 'top' | 'bottom'

/** Left/right when facing the net from that server box (top half mirrored vs bottom). */
export function netFacingHalf(q: Quadrant): CourtHalf {
  const top = q === 'TL' || q === 'TR'
  if (top) return q === 'TR' ? 'left' : 'right'
  return quadrantHalf(q)
}

/** Left/right labels from the ref’s baseline (top end vs bottom end of the court). */
export function refFacingHalf(
  quadrant: Quadrant,
  perspective: CourtPerspective,
): CourtHalf {
  const onNearHalf =
    perspective === 'top'
      ? quadrant === 'TL' || quadrant === 'TR'
      : quadrant === 'BL' || quadrant === 'BR'
  const screenLeft = quadrantHalf(quadrant) === 'left'
  if (onNearHalf) {
    return perspective === 'top'
      ? screenLeft
        ? 'left'
        : 'right'
      : screenLeft
        ? 'right'
        : 'left'
  }
  return perspective === 'top'
    ? screenLeft
      ? 'right'
      : 'left'
    : screenLeft
      ? 'left'
      : 'right'
}

export function teamAtPerspectiveEnd(perspective: CourtPerspective): CourtTeam {
  return perspective === 'top' ? 'a' : 'b'
}

export function teamForQuadrant(q: Quadrant): CourtTeam {
  return q === 'TL' || q === 'TR' ? 'a' : 'b'
}

/** Control-side server boxes (right when facing the net): TL and BR. */
export function controlServeQuadrants(): Quadrant[] {
  return COURT_QUADRANTS.filter((q) => netFacingHalf(q) === 'right')
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

export function serverQuadrantFromClient(
  half: CourtHalf,
  _clientX: number,
  clientY: number,
  pad: HTMLElement,
): Quadrant {
  const picked = serverQuadrantFromHalfTap(half, clientY, pad.getBoundingClientRect())
  return rightQuadrantForTeam(quadrantTeam(picked))
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

/** Clockwise quadrant order for position-pick highlight (top-left → top-right → bottom-right → bottom-left). */
export const CLOCKWISE_QUADRANTS: Quadrant[] = ['TL', 'TR', 'BR', 'BL']

export function playerToAssignNext(
  roster: CourtPlayer[],
  assignments: Partial<QuadrantPlayers>,
): CourtPlayer | null {
  const taken = new Set(
    COURT_QUADRANTS.filter((q) => assignments[q]?.name?.trim()).map((q) =>
      playerKey(assignments[q]!),
    ),
  )
  for (const player of roster) {
    if (!taken.has(playerKey(player))) return player
  }
  return null
}

export function currentTeamToAssign(
  assignments: Partial<QuadrantPlayers>,
): CourtTeam | null {
  if (!teamIsPlaced('a', assignments)) return 'a'
  if (!teamIsPlaced('b', assignments)) return 'b'
  return null
}

export function quadrantsForTeam(team: CourtTeam): [Quadrant, Quadrant] {
  return team === 'a' ? ['TL', 'TR'] : ['BL', 'BR']
}

/** Picker (pair[0]) on tapped side; partner on the other side of the same team. */
export function teamPlacementFromQuadrant(
  quadrant: Quadrant,
  teamPair: TeamPair,
): Partial<QuadrantPlayers> {
  const team = teamForQuadrant(quadrant)
  const picker = teamPair[0]!
  const partner = teamPair[1]!
  const half = quadrantHalf(quadrant)
  if (team === 'a') {
    return half === 'left' ? { TL: picker, TR: partner } : { TL: partner, TR: picker }
  }
  return half === 'left' ? { BL: picker, BR: partner } : { BL: partner, BR: picker }
}

/** Flip left/right within a team's pending placement. */
export function swapTeamPlacementSides(
  team: CourtTeam,
  placement: Partial<QuadrantPlayers>,
): Partial<QuadrantPlayers> {
  const [leftQ, rightQ] = quadrantsForTeam(team)
  return { [leftQ]: placement[rightQ], [rightQ]: placement[leftQ] }
}

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

type StoredPendingTeam = {
  team: CourtTeam
  placement: Partial<Record<Quadrant, StoredPlayer>>
}

type StoredCourtSetup = {
  positions: Partial<Record<Quadrant, StoredPlayer>>
  setupPhase?: 'positions' | 'serve' | 'confirm_serve'
  pendingTeam?: StoredPendingTeam
  pendingServeQuadrant?: Quadrant
  serveQuadrant?: Quadrant
  score?: TennisScore
  matchSubmitted?: boolean
  matchStartedAt?: string
  updatedAt?: string
}

export type LoadedCourtSetup = {
  assignments: Partial<QuadrantPlayers>
  setupPhase: SetupPhase
  pendingTeamPlacement: { team: CourtTeam; placement: Partial<QuadrantPlayers> } | null
  pendingServeQuadrant: Quadrant | null
  initialServeQuadrant: Quadrant | null
  score: TennisScore | null
  matchSubmitted: boolean
  matchStartedAt: string | null
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

function serializePartial(
  assignments: Partial<QuadrantPlayers>,
): Partial<Record<Quadrant, StoredPlayer>> {
  const out: Partial<Record<Quadrant, StoredPlayer>> = {}
  for (const q of COURT_QUADRANTS) {
    const p = assignments[q]
    if (p?.name?.trim()) {
      out[q] = { id: p.id, name: p.name, avatarUrl: p.avatarUrl }
    }
  }
  return out
}

function deserializePartial(
  raw: Partial<Record<Quadrant, StoredPlayer>>,
): Partial<QuadrantPlayers> {
  const out: Partial<QuadrantPlayers> = {}
  for (const q of COURT_QUADRANTS) {
    const p = raw[q]
    if (p?.name?.trim()) {
      out[q] = { id: p.id, name: p.name, avatarUrl: p.avatarUrl }
    }
  }
  return out
}

function hasAnyPlacement(assignments: Partial<QuadrantPlayers>): boolean {
  return COURT_QUADRANTS.some((q) => assignments[q]?.name?.trim())
}

export type SetupPhaseMeta = {
  setupPhase?: SetupPhase
  pendingServeQuadrant?: Quadrant | null
  serveQuadrant?: Quadrant | null
  matchStartedAt?: string | null
}

/** Single source of truth for wizard step — derived from placements, never stored alone. */
export function deriveSetupPhase(
  roster: CourtPlayer[],
  assignments: Partial<QuadrantPlayers>,
  meta: SetupPhaseMeta,
): SetupPhase {
  const complete = isCompleteAssignment(roster, assignments)
  if (complete && meta.matchStartedAt && meta.serveQuadrant) return 'ready'
  if (meta.setupPhase === 'confirm_serve' && complete && meta.pendingServeQuadrant) {
    return 'confirm_serve'
  }
  if (meta.setupPhase === 'serve' && complete) return 'serve'
  if (complete && meta.pendingServeQuadrant) return 'confirm_serve'
  if (complete) return 'serve'
  return 'positions'
}

export function normalizeLoadedCourtSetup(
  loaded: LoadedCourtSetup,
  roster: CourtPlayer[],
): LoadedCourtSetup {
  const setupPhase = deriveSetupPhase(roster, loaded.assignments, {
    setupPhase: loaded.setupPhase,
    pendingServeQuadrant: loaded.pendingServeQuadrant,
    serveQuadrant: loaded.initialServeQuadrant,
    matchStartedAt: loaded.matchStartedAt,
  })
  return {
    ...loaded,
    setupPhase,
    initialServeQuadrant: setupPhase === 'ready' ? loaded.initialServeQuadrant : null,
    pendingServeQuadrant:
      setupPhase === 'confirm_serve' ? loaded.pendingServeQuadrant : null,
  }
}

export function loadCourtSetup(key: string, roster: CourtPlayer[]): LoadedCourtSetup | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredCourtSetup | Record<Quadrant, StoredPlayer>
    const meta: StoredCourtSetup =
      'positions' in parsed
        ? parsed
        : { positions: parsed as Partial<Record<Quadrant, StoredPlayer>> }

    const gameState: GameLogSetupState = {
      updatedAt: meta.updatedAt ?? new Date().toISOString(),
      setupPhase: meta.setupPhase ?? ('positions' as SetupPhase),
      assignments: serializePartial(deserializePartial(meta.positions)),
      ...(meta.pendingTeam
        ? {
            pendingTeam: {
              team: meta.pendingTeam.team,
              placement: serializePartial(deserializePartial(meta.pendingTeam.placement)),
            },
          }
        : {}),
      pendingServeQuadrant: meta.pendingServeQuadrant ?? null,
      serveQuadrant: meta.serveQuadrant ?? null,
      score: meta.score ?? null,
      matchSubmitted: Boolean(meta.matchSubmitted),
      matchStartedAt: meta.matchStartedAt ?? null,
      setupLog: (meta as { setupLog?: SetupLogEntry[] }).setupLog,
    }

    const recovered = recoverSetupState(gameState, roster)
    if (recovered.issues.length) {
      persistValidatedSetupState(key, recovered.state)
    }

    const loaded = validatedStateToLoaded(recovered.state, roster)
    const hasProgress =
      hasAnyPlacement(loaded.assignments) || Boolean(loaded.pendingTeamPlacement)

    // #region agent log
    agentDebugIngest(
      'courtPositionSetup.ts:loadCourtSetup',
      'local load + recover',
      {
        runId: 'persist-debug',
        storedPhase: meta.setupPhase ?? null,
        storedAssignmentKeys: COURT_QUADRANTS.filter((q) => meta.positions[q]?.name?.trim()),
        recoveredPhase: recovered.state.setupPhase,
        recoveredFrom: recovered.recoveredFrom,
        valid: recovered.valid,
        issues: recovered.issues.map((i) => `${i.code}:${i.field ?? ''}`),
        loadedAssignmentKeys: COURT_QUADRANTS.filter((q) => loaded.assignments[q]?.name?.trim()),
        rosterKeys: roster.map((p) => p.name?.trim()).filter(Boolean),
        hasProgress,
      },
      recovered.recoveredFrom === 'empty' ? 'B' : 'A',
    )
    // #endregion
    if (!hasProgress && recovered.recoveredFrom === 'empty' && recovered.issues.length > 0) {
      return loaded
    }
    if (!hasProgress) return null

    logStateIngest('load-court-setup-local', {
      setupPhase: loaded.setupPhase,
      storedPhase: meta.setupPhase,
      assignmentCount: COURT_QUADRANTS.filter((q) => loaded.assignments[q]?.name?.trim()).length,
      setupLogLen: (meta as { setupLog?: unknown[] }).setupLog?.length ?? 0,
      updatedAt: meta.updatedAt ?? null,
      validated: recovered.valid,
      recoveredFrom: recovered.recoveredFrom,
      issueCount: recovered.issues.length,
    }, key)
    return loaded
  } catch {
    return null
  }
}

export function saveCourtSetupDraft(
  key: string,
  draft: {
    assignments: Partial<QuadrantPlayers>
    setupPhase: 'positions' | 'serve' | 'confirm_serve'
    pendingTeamPlacement?: { team: CourtTeam; placement: Partial<QuadrantPlayers> } | null
    pendingServeQuadrant?: Quadrant | null
  },
  roster: CourtPlayer[],
): void {
  try {
    const rawState = {
      updatedAt: new Date().toISOString(),
      setupPhase: draft.setupPhase,
      assignments: serializePartial(draft.assignments),
      ...(draft.pendingTeamPlacement
        ? {
            pendingTeam: {
              team: draft.pendingTeamPlacement.team,
              placement: serializePartial(draft.pendingTeamPlacement.placement),
            },
          }
        : {}),
      pendingServeQuadrant: draft.pendingServeQuadrant ?? null,
    }
    const { state, issues } = validateSetupState(rawState, roster)
    persistValidatedSetupState(key, state)
    // #region agent log
    agentDebugIngest(
      'courtPositionSetup.ts:saveCourtSetupDraft',
      'draft validated + persisted to local',
      {
        runId: 'persist-debug',
        inputPhase: draft.setupPhase,
        inputAssignmentKeys: COURT_QUADRANTS.filter((q) => draft.assignments[q]?.name?.trim()),
        outputPhase: state.setupPhase,
        outputAssignmentKeys: COURT_QUADRANTS.filter((q) => state.assignments[q as Quadrant]?.name?.trim()),
        outputPendingServe: state.pendingServeQuadrant ?? null,
        issues: issues.map((i) => `${i.code}:${i.field ?? ''}`),
        rosterKeys: roster.map((p) => p.name?.trim()).filter(Boolean),
      },
      draft.setupPhase !== 'positions' && state.setupPhase === 'positions' ? 'A' : 'D',
    )
    // #endregion
  } catch {
    /* ignore */
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
      updatedAt: new Date().toISOString(),
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
