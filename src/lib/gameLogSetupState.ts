import type { CourtPlayer } from './americanoSchedule'
import {
  COURT_QUADRANTS,
  isCompleteAssignment,
  normalizeLoadedCourtSetup,
  type CourtTeam,
  type LoadedCourtSetup,
  type SetupPhase,
  playerKey,
} from './courtPositionSetup'
import type { Quadrant } from './gestureCapture'
import type { QuadrantPlayers } from './gesturePadPlayers'
import type { GameLogRosterSlot } from './gameLogSerialize'
import {
  enrichSetupStateFromLog,
  setupLogLength,
  type SetupLogEntry,
  type SetupLogStage,
} from './matchSetupLog'
import {
  recoverSetupState,
  validatedStateToLoaded,
} from './matchSetupStateValidate'
import type { TennisScore } from './tennisScore'

export type GameLogSetupState = {
  updatedAt: string
  setupPhase: SetupPhase
  assignments: Partial<Record<Quadrant, { id: string | null; name: string; avatarUrl: string | null }>>
  pendingTeam?: {
    team: CourtTeam
    placement: Partial<Record<Quadrant, { id: string | null; name: string; avatarUrl: string | null }>>
  }
  pendingServeQuadrant?: Quadrant | null
  serveQuadrant?: Quadrant | null
  score?: TennisScore | null
  matchStartedAt?: string | null
  matchSubmitted?: boolean
  /** Live rally state between committed points (e.g. second serve after a fault). */
  serveAttempt?: 1 | 2
  /** Append-only labeled setup stages (player positions → serve pick → confirm → live). */
  setupLog?: SetupLogEntry[]
}

export type { SetupLogStage, SetupLogEntry }

const PHASE_RANK: Record<SetupPhase, number> = {
  positions: 0,
  serve: 1,
  confirm_serve: 2,
  ready: 3,
}

function slotPlayers(slots: GameLogRosterSlot[], padPlayers: QuadrantPlayers): Partial<QuadrantPlayers> {
  const out: Partial<QuadrantPlayers> = {}
  for (const slot of slots) {
    const scheduled = padPlayers[slot.quadrant]
    const name = slot.name?.trim() || scheduled?.name?.trim()
    if (!name) continue
    out[slot.quadrant] = {
      id: slot.playerId ?? scheduled?.id ?? null,
      name,
      avatarUrl: scheduled?.avatarUrl ?? null,
    }
  }
  return out
}

function filterToRoster(
  assignments: Partial<QuadrantPlayers>,
  roster: CourtPlayer[],
): Partial<QuadrantPlayers> {
  const rosterKeys = new Set(roster.map(playerKey))
  const out: Partial<QuadrantPlayers> = {}
  for (const q of COURT_QUADRANTS) {
    const player = assignments[q]
    if (player?.name?.trim() && rosterKeys.has(playerKey(player))) {
      out[q] = player
    }
  }
  return out
}

function hasPlacement(assignments: Partial<QuadrantPlayers>): boolean {
  return COURT_QUADRANTS.some((q) => assignments[q]?.name?.trim())
}

export function setupStateFromLoaded(
  loaded: LoadedCourtSetup,
  roster: CourtPlayer[],
  updatedAt = new Date().toISOString(),
): GameLogSetupState {
  const normalized =
    roster.length >= 4 ? normalizeLoadedCourtSetup(loaded, roster) : loaded

  const serializePartial = (assignments: Partial<QuadrantPlayers>) => {
    const out: GameLogSetupState['assignments'] = {}
    for (const q of COURT_QUADRANTS) {
      const p = assignments[q]
      if (p?.name?.trim()) {
        out[q] = { id: p.id, name: p.name, avatarUrl: p.avatarUrl ?? null }
      }
    }
    return out
  }

  return {
    updatedAt,
    setupPhase: normalized.setupPhase,
    assignments: serializePartial(normalized.assignments),
    ...(normalized.pendingTeamPlacement
      ? {
          pendingTeam: {
            team: normalized.pendingTeamPlacement.team,
            placement: serializePartial(normalized.pendingTeamPlacement.placement),
          },
        }
      : {}),
    pendingServeQuadrant: normalized.pendingServeQuadrant,
    serveQuadrant: normalized.initialServeQuadrant,
    score: normalized.score,
    matchStartedAt: normalized.matchStartedAt,
    matchSubmitted: normalized.matchSubmitted,
  }
}

export function loadedSetupFromGameLogState(
  state: GameLogSetupState,
  roster: CourtPlayer[],
): LoadedCourtSetup | null {
  const recovered = recoverSetupState(enrichSetupStateFromLog(state), roster)
  const loaded = validatedStateToLoaded(recovered.state, roster)
  if (!hasPlacement(loaded.assignments) && !loaded.pendingTeamPlacement) return null
  return loaded
}

export function loadedSetupFromRosterSlots(
  slots: GameLogRosterSlot[],
  padPlayers: QuadrantPlayers,
  roster: CourtPlayer[],
): LoadedCourtSetup | null {
  const assignments = filterToRoster(slotPlayers(slots, padPlayers), roster)
  if (!isCompleteAssignment(roster, assignments)) return null
  return {
    assignments,
    setupPhase: 'serve',
    pendingTeamPlacement: null,
    pendingServeQuadrant: null,
    initialServeQuadrant: null,
    score: null,
    matchSubmitted: false,
    matchStartedAt: null,
  }
}

export function readLocalSetupUpdatedAt(key: string): string | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { updatedAt?: string }
    return parsed.updatedAt ?? null
  } catch {
    return null
  }
}

export function preferRemoteSetupState(
  local: LoadedCourtSetup | null,
  remote: GameLogSetupState | null,
  localKey: string,
): boolean {
  if (!remote?.updatedAt) return false
  if (!local) return true
  const localAt = readLocalSetupUpdatedAt(localKey)
  if (localAt && remote.updatedAt > localAt) return true
  if (!localAt && PHASE_RANK[remote.setupPhase] > PHASE_RANK[local.setupPhase]) return true
  if (remote.matchStartedAt && !local.matchStartedAt) return true
  if (remote.setupPhase === 'ready' && local.setupPhase !== 'ready') return true
  const localLogLen = readLocalSetupLogLength(localKey)
  if (setupLogLength(remote) > localLogLen) return true
  return false
}

export function persistLocalSetupLog(key: string, log: SetupLogEntry[]): void {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    parsed.setupLog = log
    if (log.length) parsed.updatedAt = log[log.length - 1]!.at
    localStorage.setItem(key, JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}

export function readLocalSetupLogLength(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { setupLog?: SetupLogEntry[] }
    return parsed.setupLog?.length ?? 0
  } catch {
    return 0
  }
}

export function readLocalSetupLog(key: string): SetupLogEntry[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { setupLog?: SetupLogEntry[] }
    return parsed.setupLog ?? []
  } catch {
    return []
  }
}

export function writeCourtSetupFromGameLogState(
  key: string,
  state: GameLogSetupState,
  roster: CourtPlayer[],
): LoadedCourtSetup | null {
  const loaded = loadedSetupFromGameLogState(state, roster)
  if (!loaded) return null
  writeCourtSetupToLocal(key, loaded, state.updatedAt, state.setupLog)
  return loaded
}

export function writeCourtSetupToLocal(
  key: string,
  loaded: LoadedCourtSetup,
  updatedAt?: string,
  setupLog?: SetupLogEntry[],
): void {
  const state = setupStateFromLoaded(loaded, [], updatedAt ?? new Date().toISOString())
  if (setupLog?.length) state.setupLog = setupLog
  try {
    const payload = {
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
