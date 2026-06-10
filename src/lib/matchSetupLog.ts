import type { CourtTeam, LoadedCourtSetup, SetupPhase } from './courtPositionSetup'
import type { Quadrant } from './gestureCapture'
import type { GameLogSetupState } from './gameLogSetupState'
import type { TennisScore } from './tennisScore'

/** Human-readable setup stages — appended to the save log as the ref progresses. */
export type SetupLogStage =
  | 'player_positions'
  | 'serve_pick'
  | 'confirm_serve'
  | 'match_ready'
  | 'live_play'

export type SetupLogEntry = {
  at: string
  stage: SetupLogStage
  setupPhase: SetupPhase
  assignments: GameLogSetupState['assignments']
  pendingTeam?: GameLogSetupState['pendingTeam']
  pendingServeQuadrant?: Quadrant | null
  serveQuadrant?: Quadrant | null
  score?: TennisScore | null
  matchStartedAt?: string | null
  serveAttempt?: 1 | 2
}

const MAX_SETUP_LOG = 48

const STAGE_FOR_PHASE: Record<SetupPhase, SetupLogStage> = {
  positions: 'player_positions',
  serve: 'serve_pick',
  confirm_serve: 'confirm_serve',
  ready: 'live_play',
}

export function stageForPhase(phase: SetupPhase, explicit?: SetupLogStage): SetupLogStage {
  return explicit ?? STAGE_FOR_PHASE[phase]
}

export function setupLogEntryFromState(
  state: GameLogSetupState,
  stage?: SetupLogStage,
): SetupLogEntry {
  return {
    at: state.updatedAt,
    stage: stageForPhase(state.setupPhase, stage),
    setupPhase: state.setupPhase,
    assignments: state.assignments,
    ...(state.pendingTeam ? { pendingTeam: state.pendingTeam } : {}),
    pendingServeQuadrant: state.pendingServeQuadrant ?? null,
    serveQuadrant: state.serveQuadrant ?? null,
    score: state.score ?? null,
    matchStartedAt: state.matchStartedAt ?? null,
    ...(state.serveAttempt ? { serveAttempt: state.serveAttempt } : {}),
  }
}

function entryFingerprint(entry: SetupLogEntry): string {
  const { at: _at, ...rest } = entry
  return JSON.stringify(rest)
}

/** Append a labeled setup snapshot when values changed (deduped per stage payload). */
export function appendSetupLogEntry(
  state: GameLogSetupState,
  explicitStage?: SetupLogStage,
): GameLogSetupState {
  const entry = setupLogEntryFromState(state, explicitStage)
  const log = state.setupLog ?? []
  const last = log[log.length - 1]
  if (last && entryFingerprint(last) === entryFingerprint(entry)) {
    return state
  }
  return {
    ...state,
    setupLog: [...log, entry].slice(-MAX_SETUP_LOG),
  }
}

/** Replay the latest setup log entry as one atomic checkpoint (no field-by-field mixing). */
export function enrichSetupStateFromLog(state: GameLogSetupState): GameLogSetupState {
  const last = state.setupLog?.[state.setupLog.length - 1]
  if (!last) return state

  const live =
    state.setupPhase === 'ready' ||
    last.stage === 'live_play' ||
    last.stage === 'match_ready'

  if (live) {
    return {
      ...state,
      updatedAt: state.updatedAt || last.at,
      assignments: Object.keys(state.assignments).length ? state.assignments : last.assignments,
      serveQuadrant: state.serveQuadrant ?? last.serveQuadrant,
      matchStartedAt: state.matchStartedAt ?? last.matchStartedAt,
      score: state.score ?? last.score,
      serveAttempt: state.serveAttempt ?? last.serveAttempt,
    }
  }

  return {
    ...state,
    updatedAt: last.at,
    setupPhase: last.setupPhase,
    assignments: last.assignments,
    pendingTeam: last.pendingTeam,
    pendingServeQuadrant: last.pendingServeQuadrant ?? null,
    serveQuadrant: last.serveQuadrant ?? null,
    score: last.score ?? null,
    matchStartedAt: last.matchStartedAt ?? null,
    serveAttempt: last.serveAttempt,
  }
}

export function setupLogLength(state: GameLogSetupState | null | undefined): number {
  return state?.setupLog?.length ?? 0
}

export function loadedSetupFromSetupLogEntry(
  entry: SetupLogEntry,
  rosterFilter: (assignments: LoadedCourtSetup['assignments']) => LoadedCourtSetup['assignments'],
): LoadedCourtSetup | null {
  const assignments = rosterFilter(deserializeAssignments(entry.assignments))
  const pendingPlacement = entry.pendingTeam
    ? rosterFilter(deserializeAssignments(entry.pendingTeam.placement))
    : {}
  const pendingTeamPlacement =
    entry.pendingTeam && hasPlacement(pendingPlacement)
      ? { team: entry.pendingTeam.team as CourtTeam, placement: pendingPlacement }
      : null

  if (!hasPlacement(assignments) && !pendingTeamPlacement) return null

  const setupPhase = entry.setupPhase
  const serveQuadrant = entry.serveQuadrant ?? null

  return {
    assignments,
    setupPhase,
    pendingTeamPlacement,
    pendingServeQuadrant: entry.pendingServeQuadrant ?? null,
    initialServeQuadrant: setupPhase === 'ready' ? serveQuadrant : null,
    score: entry.score ?? null,
    matchSubmitted: false,
    matchStartedAt: entry.matchStartedAt ?? null,
  }
}

function deserializeAssignments(
  raw: GameLogSetupState['assignments'],
): LoadedCourtSetup['assignments'] {
  const out: LoadedCourtSetup['assignments'] = {}
  for (const [q, p] of Object.entries(raw)) {
    if (p?.name?.trim()) {
      out[q as Quadrant] = { id: p.id, name: p.name, avatarUrl: p.avatarUrl ?? null }
    }
  }
  return out
}

function hasPlacement(assignments: LoadedCourtSetup['assignments']): boolean {
  return Object.values(assignments).some((p) => p?.name?.trim())
}
