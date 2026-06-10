import { devDebugLog } from './debug/devDebug'
import type { LoadedCourtSetup } from './courtPositionSetup'
import type { Quadrant } from './gestureCapture'
import type { QuadrantPlayers } from './gesturePadPlayers'
import type { GameLogSetupState } from './gameLogSetupState'
import type { MatchGestureLog } from './matchLogServer'
import type { MatchSessionRecord } from './matchSessionLog'

const CHANNEL = 'STATE-INGEST'

function quadrantSummary(players: Partial<QuadrantPlayers> | null | undefined) {
  if (!players) return {}
  const out: Partial<Record<Quadrant, string>> = {}
  for (const q of ['TL', 'TR', 'BL', 'BR'] as Quadrant[]) {
    const name = players[q]?.name?.trim()
    if (name) out[q] = name
  }
  return out
}

export function logStateIngest(
  step: string,
  data: Record<string, unknown>,
  courtSetupKey?: string,
): void {
  devDebugLog(CHANNEL, step, data, courtSetupKey ?? 'sp-dev')
}

export function logHydrateDecision(
  courtSetupKey: string,
  label: string,
  payload: {
    source: string
    setupPhase?: string
    assignments?: Partial<QuadrantPlayers>
    padPlayers?: Partial<QuadrantPlayers>
    remote?: Pick<MatchGestureLog, 'pointEvents' | 'gestures' | 'setupState' | 'roster' | 'updatedAt'> | null
    localSetup?: LoadedCourtSetup | null
    localSession?: MatchSessionRecord | null
    chosen?: LoadedCourtSetup | null
    reason?: string
  },
): void {
  logStateIngest(label, {
    source: payload.source,
    reason: payload.reason,
    setupPhase: payload.setupPhase ?? payload.chosen?.setupPhase ?? payload.localSetup?.setupPhase,
    remotePoints: payload.remote?.pointEvents.length ?? 0,
    remoteGestures: payload.remote?.gestures.length ?? 0,
    remoteSetupPhase: payload.remote?.setupState?.setupPhase,
    remoteSetupLogLen: payload.remote?.setupState?.setupLog?.length ?? 0,
    remoteRosterLen: payload.remote?.roster.length ?? 0,
    localPoints: payload.localSession?.pointEvents.length ?? 0,
    assignments: quadrantSummary(payload.assignments ?? payload.chosen?.assignments),
    padPlayers: quadrantSummary(payload.padPlayers),
    pendingServe: payload.chosen?.pendingServeQuadrant ?? null,
    matchStarted: Boolean(payload.chosen?.matchStartedAt),
  }, courtSetupKey)
}

export function logPadUiSnapshot(
  courtSetupKey: string,
  snapshot: {
    setupHydrated: boolean
    setupPhase: string
    assignments: Partial<QuadrantPlayers>
    padPlayers: Partial<QuadrantPlayers>
    showPlacementPrompt: boolean
    pendingTeam: boolean
    scoreboardSource: string
  },
): void {
  logStateIngest('pad-ui-snapshot', {
    setupHydrated: snapshot.setupHydrated,
    setupPhase: snapshot.setupPhase,
    showPlacementPrompt: snapshot.showPlacementPrompt,
    pendingTeam: snapshot.pendingTeam,
    scoreboardSource: snapshot.scoreboardSource,
    assignments: quadrantSummary(snapshot.assignments),
    padPlayers: quadrantSummary(snapshot.padPlayers),
  }, courtSetupKey)
}

export function logSetupStateWrite(
  courtSetupKey: string,
  state: GameLogSetupState | null | undefined,
  via: string,
): void {
  if (!state) return
  logStateIngest('setup-state-write', {
    via,
    setupPhase: state.setupPhase,
    setupLogLen: state.setupLog?.length ?? 0,
    assignments: quadrantSummary(state.assignments as Partial<QuadrantPlayers>),
    serveQuadrant: state.serveQuadrant,
    matchStartedAt: state.matchStartedAt,
  }, courtSetupKey)
}
