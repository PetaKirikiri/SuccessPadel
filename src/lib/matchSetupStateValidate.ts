import { z } from 'zod'
import type { CourtPlayer } from './americanoSchedule'
import {
  COURT_QUADRANTS,
  deriveSetupPhase,
  isCompleteAssignment,
  playerKey,
  quadrantsForTeam,
  stripIncompleteTeamAssignments,
  teamIsPlaced,
  type CourtTeam,
  type LoadedCourtSetup,
  type SetupPhase,
} from './courtPositionSetup'
import { agentDebugIngest } from './debug/devDebug'
import { devDebugLog } from './debug/devDebug'
import type { Quadrant } from './gestureCapture'
import type { QuadrantPlayers } from './gesturePadPlayers'
import type { GameLogSetupState } from './gameLogSetupState'
import type { SetupLogEntry } from './matchSetupLog'

const quadrantSchema = z.enum(['TL', 'TR', 'BL', 'BR'])

const storedPlayerSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
})

const assignmentsRecordSchema = z.partialRecord(quadrantSchema, storedPlayerSchema)

export const gameLogSetupStateSchema = z.object({
  updatedAt: z.string(),
  setupPhase: z.enum(['positions', 'serve', 'confirm_serve', 'ready']),
  assignments: assignmentsRecordSchema.default({}),
  pendingTeam: z
    .object({
      team: z.enum(['a', 'b']),
      placement: assignmentsRecordSchema,
    })
    .optional(),
  pendingServeQuadrant: quadrantSchema.nullable().optional(),
  serveQuadrant: quadrantSchema.nullable().optional(),
  score: z
    .object({
      pointsA: z.number(),
      pointsB: z.number(),
      gamesA: z.number(),
      gamesB: z.number(),
    })
    .nullable()
    .optional(),
  matchStartedAt: z.string().nullable().optional(),
  matchSubmitted: z.boolean().optional(),
  serveAttempt: z.union([z.literal(1), z.literal(2)]).optional(),
  setupLog: z.array(z.record(z.string(), z.unknown())).optional(),
})

export type SetupStateIssueCode =
  | 'SCHEMA_PARSE'
  | 'ORPHAN_QUADRANT'
  | 'FIELD_FORBIDDEN'
  | 'FIELD_REQUIRED'
  | 'PHASE_MISMATCH'
  | 'ROSTER_UNKNOWN_PLAYER'
  | 'PENDING_TEAM_INCOMPLETE'
  | 'RECOVERED_FROM_LOG'
  | 'RECOVERED_EMPTY'

export type SetupStateIssue = {
  code: SetupStateIssueCode
  message: string
  field?: string
  phase: SetupPhase
}

export type SetupStateValidationResult = {
  valid: boolean
  issues: SetupStateIssue[]
  state: GameLogSetupState
  recoveredFrom: 'raw' | 'normalized' | 'setup_log' | 'empty'
}

function filterAssignmentsToRoster(
  assignments: Partial<QuadrantPlayers>,
  roster: CourtPlayer[],
): Partial<QuadrantPlayers> {
  const rosterKeys = new Set(roster.map(playerKey))
  const out: Partial<QuadrantPlayers> = {}
  for (const q of COURT_QUADRANTS) {
    const player = assignments[q]
    if (player?.name?.trim() && rosterKeys.has(playerKey(player))) {
      out[q] = { id: player.id, name: player.name, avatarUrl: player.avatarUrl ?? null }
    } else if (player?.name?.trim()) {
      /* unknown — dropped silently here; issue raised separately */
    }
  }
  return out
}

function deserializeAssignments(
  raw: GameLogSetupState['assignments'],
): Partial<QuadrantPlayers> {
  const out: Partial<QuadrantPlayers> = {}
  for (const q of COURT_QUADRANTS) {
    const p = raw[q]
    if (p?.name?.trim()) {
      out[q] = { id: p.id, name: p.name, avatarUrl: p.avatarUrl ?? null }
    }
  }
  return out
}

function serializeAssignments(assignments: Partial<QuadrantPlayers>): GameLogSetupState['assignments'] {
  const out: GameLogSetupState['assignments'] = {}
  for (const q of COURT_QUADRANTS) {
    const p = assignments[q]
    if (p?.name?.trim()) {
      out[q] = { id: p.id, name: p.name, avatarUrl: p.avatarUrl ?? null }
    }
  }
  return out
}

function orphanQuadrants(assignments: Partial<QuadrantPlayers>): Quadrant[] {
  const orphans: Quadrant[] = []
  for (const team of ['a', 'b'] as CourtTeam[]) {
    if (teamIsPlaced(team, assignments)) continue
    for (const q of quadrantsForTeam(team)) {
      if (assignments[q]?.name?.trim()) orphans.push(q)
    }
  }
  return orphans
}

function unknownRosterPlayers(
  assignments: Partial<QuadrantPlayers>,
  roster: CourtPlayer[],
): string[] {
  const rosterKeys = new Set(roster.map(playerKey))
  const unknown: string[] = []
  for (const q of COURT_QUADRANTS) {
    const player = assignments[q]
    if (player?.name?.trim() && !rosterKeys.has(playerKey(player))) {
      unknown.push(`${q}:${player.name}`)
    }
  }
  return unknown
}

const FORBIDDEN_AT_PHASE: Record<SetupPhase, (keyof GameLogSetupState)[]> = {
  positions: [
    'serveQuadrant',
    'pendingServeQuadrant',
    'matchStartedAt',
    'score',
    'matchSubmitted',
    'serveAttempt',
  ],
  serve: [
    'pendingTeam',
    'serveQuadrant',
    'pendingServeQuadrant',
    'matchStartedAt',
    'score',
    'matchSubmitted',
    'serveAttempt',
  ],
  confirm_serve: ['pendingTeam', 'serveQuadrant', 'matchStartedAt', 'score', 'matchSubmitted', 'serveAttempt'],
  ready: ['pendingTeam', 'pendingServeQuadrant'],
}

const REQUIRED_AT_PHASE: Record<SetupPhase, (keyof GameLogSetupState)[]> = {
  positions: [],
  serve: [],
  confirm_serve: ['pendingServeQuadrant'],
  ready: ['serveQuadrant', 'matchStartedAt'],
}

function hasValue(state: GameLogSetupState, field: keyof GameLogSetupState): boolean {
  const v = state[field]
  if (v === null || v === undefined) return false
  // Falsy scalars (e.g. matchSubmitted:false) are defaults, not meaningful presence.
  if (v === false) return false
  if (field === 'assignments') {
    return Object.values(state.assignments).some((p) => p?.name?.trim())
  }
  if (field === 'pendingTeam') return Boolean(state.pendingTeam)
  return true
}

function isCompleteAssignments(state: GameLogSetupState, roster: CourtPlayer[]): boolean {
  return isCompleteAssignment(roster, deserializeAssignments(state.assignments))
}

function pendingTeamValid(state: GameLogSetupState): boolean {
  if (!state.pendingTeam) return true
  const placement = deserializeAssignments(state.pendingTeam.placement)
  return teamIsPlaced(state.pendingTeam.team, placement)
}

function stripForbiddenFields(state: GameLogSetupState, phase: SetupPhase): GameLogSetupState {
  const next = { ...state }
  for (const field of FORBIDDEN_AT_PHASE[phase]) {
    if (field === 'pendingTeam') delete next.pendingTeam
    else if (field === 'serveQuadrant') next.serveQuadrant = null
    else if (field === 'pendingServeQuadrant') next.pendingServeQuadrant = null
    else if (field === 'matchStartedAt') next.matchStartedAt = null
    else if (field === 'score') next.score = null
    else if (field === 'matchSubmitted') next.matchSubmitted = false
    else if (field === 'serveAttempt') delete next.serveAttempt
  }
  return next
}

function checkPhaseSemantics(
  state: GameLogSetupState,
  roster: CourtPlayer[],
  phase: SetupPhase,
): SetupStateIssue[] {
  const issues: SetupStateIssue[] = []

  for (const field of FORBIDDEN_AT_PHASE[phase]) {
    if (hasValue(state, field)) {
      issues.push({
        code: 'FIELD_FORBIDDEN',
        message: `${field} must not exist at phase "${phase}"`,
        field,
        phase,
      })
    }
  }

  for (const field of REQUIRED_AT_PHASE[phase]) {
    if (!hasValue(state, field)) {
      issues.push({
        code: 'FIELD_REQUIRED',
        message: `${field} is required at phase "${phase}"`,
        field,
        phase,
      })
    }
  }

  if (phase === 'positions') {
    for (const q of orphanQuadrants(deserializeAssignments(state.assignments))) {
      issues.push({
        code: 'ORPHAN_QUADRANT',
        message: `Quadrant ${q} has a player but its team is incomplete`,
        field: q,
        phase,
      })
    }
    if (state.pendingTeam && !pendingTeamValid(state)) {
      issues.push({
        code: 'PENDING_TEAM_INCOMPLETE',
        message: `pendingTeam placement must fill both quadrants for team ${state.pendingTeam.team}`,
        field: 'pendingTeam',
        phase,
      })
    }
  }

  if ((phase === 'serve' || phase === 'confirm_serve' || phase === 'ready') && !isCompleteAssignments(state, roster)) {
    issues.push({
      code: 'FIELD_REQUIRED',
      message: 'assignments must include all four roster players',
      field: 'assignments',
      phase,
    })
  }

  return issues
}

function setupStateFromLogEntry(entry: SetupLogEntry, preservedLog?: SetupLogEntry[]): GameLogSetupState {
  return {
    updatedAt: entry.at,
    setupPhase: entry.setupPhase,
    assignments: entry.assignments,
    ...(entry.pendingTeam ? { pendingTeam: entry.pendingTeam } : {}),
    pendingServeQuadrant: entry.pendingServeQuadrant ?? null,
    serveQuadrant: entry.serveQuadrant ?? null,
    score: entry.score ?? null,
    matchStartedAt: entry.matchStartedAt ?? null,
    ...(entry.serveAttempt ? { serveAttempt: entry.serveAttempt } : {}),
    ...(preservedLog?.length ? { setupLog: preservedLog } : {}),
  }
}

export function emptyPositionsSetupState(updatedAt = new Date().toISOString()): GameLogSetupState {
  return {
    updatedAt,
    setupPhase: 'positions',
    assignments: {},
  }
}

/** Validate save-game setup slice for its declared/derived phase. */
export function validateSetupState(
  raw: GameLogSetupState,
  roster: CourtPlayer[],
): SetupStateValidationResult {
  const parse = gameLogSetupStateSchema.safeParse(raw)
  if (!parse.success) {
    return {
      valid: false,
      issues: [
        {
          code: 'SCHEMA_PARSE',
          message: parse.error.issues.map((i) => i.message).join('; '),
          phase: 'positions',
        },
      ],
      state: emptyPositionsSetupState(raw.updatedAt),
      recoveredFrom: 'empty',
    }
  }

  let state: GameLogSetupState = {
    ...parse.data,
    assignments: serializeAssignments(
      deserializeAssignments(parse.data.assignments as GameLogSetupState['assignments']),
    ),
    pendingTeam: parse.data.pendingTeam
      ? {
          team: parse.data.pendingTeam.team,
          placement: serializeAssignments(
            deserializeAssignments(
              parse.data.pendingTeam.placement as GameLogSetupState['assignments'],
            ),
          ),
        }
      : undefined,
    setupLog: raw.setupLog as SetupLogEntry[] | undefined,
  }
  const issues: SetupStateIssue[] = []

  const rawAssignments = deserializeAssignments(state.assignments)
  for (const label of unknownRosterPlayers(rawAssignments, roster)) {
    issues.push({
      code: 'ROSTER_UNKNOWN_PLAYER',
      message: `Player not in match roster: ${label}`,
      field: 'assignments',
      phase: state.setupPhase,
    })
  }

  const filtered = filterAssignmentsToRoster(rawAssignments, roster)
  const stripped = stripIncompleteTeamAssignments(filtered)
  for (const q of orphanQuadrants(filtered)) {
    issues.push({
      code: 'ORPHAN_QUADRANT',
      message: `Stripped orphan placement at ${q}`,
      field: q,
      phase: 'positions',
    })
  }

  state = {
    ...state,
    assignments: serializeAssignments(stripped),
  }

  if (state.pendingTeam) {
    const pendingPlacement = filterAssignmentsToRoster(
      deserializeAssignments(state.pendingTeam.placement),
      roster,
    )
    if (!teamIsPlaced(state.pendingTeam.team, pendingPlacement)) {
      issues.push({
        code: 'PENDING_TEAM_INCOMPLETE',
        message: 'Dropped incomplete pendingTeam placement',
        field: 'pendingTeam',
        phase: 'positions',
      })
      delete state.pendingTeam
    } else {
      state.pendingTeam = {
        team: state.pendingTeam.team,
        placement: serializeAssignments(pendingPlacement),
      }
    }
  }

  const derivedPhase = deriveSetupPhase(roster, stripped, {
    setupPhase: state.setupPhase,
    pendingServeQuadrant: state.pendingServeQuadrant,
    serveQuadrant: state.serveQuadrant,
    matchStartedAt: state.matchStartedAt,
  })

  if (derivedPhase !== state.setupPhase) {
    issues.push({
      code: 'PHASE_MISMATCH',
      message: `Declared phase "${state.setupPhase}" but data implies "${derivedPhase}"`,
      field: 'setupPhase',
      phase: derivedPhase,
    })
    state.setupPhase = derivedPhase
  }

  state = stripForbiddenFields(state, derivedPhase)
  const semanticIssues = checkPhaseSemantics(state, roster, derivedPhase)
  issues.push(...semanticIssues)

  const normalized = issues.some((i) =>
    ['ORPHAN_QUADRANT', 'PHASE_MISMATCH', 'FIELD_FORBIDDEN', 'PENDING_TEAM_INCOMPLETE', 'ROSTER_UNKNOWN_PLAYER'].includes(
      i.code,
    ),
  )
  return {
    valid: semanticIssues.length === 0,
    issues,
    state,
    recoveredFrom: semanticIssues.length === 0 ? (normalized ? 'normalized' : 'raw') : 'normalized',
  }
}

/** Memory-card loader: validate, then rewind setupLog, then empty positions. */
export function recoverSetupState(
  raw: GameLogSetupState,
  roster: CourtPlayer[],
): SetupStateValidationResult {
  const first = validateSetupState(raw, roster)
  if (first.valid) {
    logValidation(first, roster.length)
    return first
  }

  const log = raw.setupLog ?? []
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i] as SetupLogEntry
    const candidate = setupStateFromLogEntry(entry, log as SetupLogEntry[])
    const result = validateSetupState(candidate, roster)
    if (result.valid) {
      result.recoveredFrom = 'setup_log'
      result.issues = [
        ...first.issues,
        {
          code: 'RECOVERED_FROM_LOG',
          message: `Recovered from setupLog entry ${i} (${entry.stage})`,
          phase: result.state.setupPhase,
        },
      ]
      logValidation(result, roster.length)
      return result
    }
  }

  const empty = emptyPositionsSetupState(raw.updatedAt)
  empty.setupLog = raw.setupLog as SetupLogEntry[] | undefined
  const result: SetupStateValidationResult = {
    valid: true,
    issues: [
      ...first.issues,
      {
        code: 'RECOVERED_EMPTY',
        message: 'Save corrupt for current progress — reset to empty player_positions',
        phase: 'positions',
      },
    ],
    state: empty,
    recoveredFrom: 'empty',
  }
  logValidation(result, roster.length)
  return result
}

export function validatedStateToLoaded(
  state: GameLogSetupState,
  roster: CourtPlayer[],
): LoadedCourtSetup {
  const assignments = filterAssignmentsToRoster(deserializeAssignments(state.assignments), roster)
  const pendingPlacement = state.pendingTeam
    ? filterAssignmentsToRoster(deserializeAssignments(state.pendingTeam.placement), roster)
    : {}
  const pendingTeamPlacement =
    state.pendingTeam && teamIsPlaced(state.pendingTeam.team, pendingPlacement)
      ? { team: state.pendingTeam.team, placement: pendingPlacement }
      : null

  return {
    assignments,
    setupPhase: state.setupPhase,
    pendingTeamPlacement,
    pendingServeQuadrant: state.pendingServeQuadrant ?? null,
    initialServeQuadrant: state.setupPhase === 'ready' ? (state.serveQuadrant ?? null) : null,
    score: state.score ?? null,
    matchSubmitted: Boolean(state.matchSubmitted),
    matchStartedAt: state.matchStartedAt ?? null,
  }
}

/** Write validated memory-card slice back to localStorage (self-heal after corrupt load). */
export function persistValidatedSetupState(key: string, state: GameLogSetupState): void {
  try {
    const raw = localStorage.getItem(key)
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    const payload = {
      ...existing,
      positions: state.assignments,
      setupPhase: state.setupPhase,
      updatedAt: state.updatedAt,
      ...(state.pendingTeam ? { pendingTeam: state.pendingTeam } : {}),
      ...(state.pendingServeQuadrant ? { pendingServeQuadrant: state.pendingServeQuadrant } : {}),
      ...(state.serveQuadrant ? { serveQuadrant: state.serveQuadrant } : {}),
      ...(state.score ? { score: state.score } : {}),
      ...(state.matchSubmitted ? { matchSubmitted: true } : {}),
      ...(state.matchStartedAt ? { matchStartedAt: state.matchStartedAt } : {}),
      ...(state.setupLog?.length ? { setupLog: state.setupLog } : {}),
    }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

function logValidation(result: SetupStateValidationResult, rosterLen: number): void {
  if (!result.issues.length && result.recoveredFrom === 'raw') return
  const payload = {
    valid: result.valid,
    recoveredFrom: result.recoveredFrom,
    phase: result.state.setupPhase,
    issueCount: result.issues.length,
    issues: result.issues.map((i) => ({ code: i.code, message: i.message, field: i.field })),
    assignmentCount: Object.keys(result.state.assignments).filter(
      (q) => result.state.assignments[q as Quadrant]?.name?.trim(),
    ).length,
    rosterLen,
    runId: 'save-validate',
  }
  devDebugLog('STATE-VALIDATE', 'setup save validated', payload)
  agentDebugIngest('matchSetupStateValidate.ts:recover', 'save-game setup validation', payload, 'SAVE')
}
