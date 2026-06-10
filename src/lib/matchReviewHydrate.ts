import {
  loadCourtSetup,
  rosterFromQuadrants,
  type LoadedCourtSetup,
} from './courtPositionSetup'
import { fromGameLogGesture, fromGameLogPoint } from './gameLogSerialize'
import {
  loadedSetupFromGameLogState,
  loadedSetupFromRosterSlots,
  preferRemoteSetupState,
  readLocalSetupLog,
  readLocalSetupLogLength,
  readLocalSetupUpdatedAt,
  setupStateFromLoaded,
  writeCourtSetupFromGameLogState,
  writeCourtSetupToLocal,
  type GameLogSetupState,
  type SetupLogStage,
} from './gameLogSetupState'
import { appendSetupLogEntry, setupLogLength } from './matchSetupLog'
import type { Quadrant } from './gestureCapture'
import { importGesturesForSession, readGestureDebugLog } from './gestureDebugLog'
import type { QuadrantPlayers } from './gesturePadPlayers'
import type { MatchGestureLog } from './matchLogServer'
import {
  importMatchSession,
  loadMatchSession,
  type MatchSessionRecord,
} from './matchSessionLog'
import { scoreFromSession, serveAttemptFromSession } from './matchScorerUndo'
import { agentDebugIngest } from './debug/devDebug'
import { logHydrateDecision } from './matchCourtStateDebug'
import type { TennisScore } from './tennisScore'
import type { CourtPlayer } from './americanoSchedule'

/** True when a server log represents a played-out match worth reviewing. */
export function isReviewableLog(log: MatchGestureLog | null): boolean {
  return Boolean(log && log.finalScore && log.pointEvents.length > 0)
}

function sessionGestureCount(session: MatchSessionRecord | null): number {
  if (!session) return 0
  return session.gestureEntries?.length ?? session.gestureIds.length
}

/** Remote DB log is newer or richer than local session (points, gestures, or row timestamp). */
export function remoteLogIsAheadOfLocal(
  courtSetupKey: string,
  local: MatchSessionRecord | null,
  log: MatchGestureLog,
  localSetupUpdatedAt: string | null,
): boolean {
  if (!local) {
    return (
      log.pointEvents.length > 0 ||
      log.gestures.length > 0 ||
      setupLogLength(log.setupState) > readLocalSetupLogLength(courtSetupKey)
    )
  }

  const remotePoints = log.pointEvents.length
  const localPoints = local.pointEvents.length
  if (remotePoints > localPoints) return true
  if (remotePoints < localPoints) return false

  const remoteGestures = log.gestures.length
  const localGestures = sessionGestureCount(local)
  if (remoteGestures > localGestures) return true

  const remoteAt = log.updatedAt ?? log.setupState?.updatedAt ?? null
  if (remoteAt && localSetupUpdatedAt && remoteAt > localSetupUpdatedAt && remoteGestures >= localGestures) {
    return true
  }

  if (setupLogLength(log.setupState) > readLocalSetupLogLength(courtSetupKey)) return true

  const remoteScore = log.setupState?.score
  const localScore = local.pointEvents[0]?.scoreAfter
  if (remoteScore && localScore && JSON.stringify(remoteScore) !== JSON.stringify(localScore)) {
    if (remoteAt && (!localSetupUpdatedAt || remoteAt >= localSetupUpdatedAt)) return true
  }

  return false
}

function importTimelineFromLog(courtSetupKey: string, log: MatchGestureLog): void {
  const gestureEntries = log.gestures.map(fromGameLogGesture)
  const pointEvents = log.pointEvents.map(fromGameLogPoint)
  importMatchSession({
    id: courtSetupKey,
    competitionId: log.competitionId ?? undefined,
    gameNumber: log.gameNumber ?? undefined,
    courtId: log.courtId ?? undefined,
    matchStartedAt: log.matchStartedAt,
    matchEndedAt: log.matchEndedAt ?? undefined,
    finalScore: log.finalScore ?? undefined,
    winner: log.winner ?? undefined,
    gestureIds: gestureEntries.map((g) => g.id),
    gestureEntries,
    pointEvents,
    playerStats: log.playerStats,
    savedLocally: true,
    isFriendly: Boolean(log.friendlySessionId),
  })
  importGesturesForSession(courtSetupKey, gestureEntries)
}

/** Score + serve attempt after local session / debug log are in sync. */
export function restoreLiveMatchFromLocalStorage(
  courtSetupKey: string,
  setupState?: GameLogSetupState | null,
): { score: TennisScore; serveAttempt: 1 | 2 } {
  const session = loadMatchSession(courtSetupKey)
  const score = scoreFromSession(session)
  let serveAttempt = serveAttemptFromSession(session, readGestureDebugLog())
  if (setupState?.serveAttempt) serveAttempt = setupState.serveAttempt
  return { score, serveAttempt }
}

function loadedFromServerLog(
  log: MatchGestureLog,
  padPlayers: QuadrantPlayers,
  roster: CourtPlayer[],
): LoadedCourtSetup | null {
  const remoteState = log.setupState
  if (remoteState?.updatedAt) {
    const fromState = loadedSetupFromGameLogState(remoteState, roster)
    if (fromState) return fromState
  }
  const setupPastPositions =
    remoteState?.setupPhase === 'serve' ||
    remoteState?.setupPhase === 'confirm_serve' ||
    remoteState?.setupPhase === 'ready' ||
    Boolean(log.matchStartedAt || log.pointEvents.length > 0)

  if (log.roster.length >= 4 && setupPastPositions) {
    const fromRoster = loadedSetupFromRosterSlots(log.roster, padPlayers, roster)
    if (fromRoster) {
      if (log.matchStartedAt || log.pointEvents.length > 0) {
        const lastPoint =
          log.pointEvents.length > 0 ? fromGameLogPoint(log.pointEvents[0]!) : null
        const serveQuadrant =
          (remoteState?.serveQuadrant as Quadrant | undefined) ??
          (lastPoint?.winnerQuadrant as Quadrant | undefined) ??
          'BR'
        return {
          ...fromRoster,
          setupPhase: 'ready',
          initialServeQuadrant: serveQuadrant,
          score: log.finalScore ?? lastPoint?.scoreAfter ?? remoteState?.score ?? null,
          matchStartedAt: log.matchStartedAt,
          matchSubmitted: Boolean(log.finalScore && log.matchEndedAt),
        }
      }
      return fromRoster
    }
  }
  return null
}

/**
 * DB-first: merge remote setup + session into local storage. Returns the setup
 * that should drive the pad (remote wins when newer or more advanced).
 */
export function mergeServerLogIntoLocalCourt(
  courtSetupKey: string,
  log: MatchGestureLog,
  padPlayers: QuadrantPlayers,
): LoadedCourtSetup | null {
  const roster = rosterFromQuadrants(padPlayers)
  const local = loadCourtSetup(courtSetupKey, roster)
  const remoteLoaded = loadedFromServerLog(log, padPlayers, roster)
  const localSession = loadMatchSession(courtSetupKey)
  const localSetupAt = readLocalSetupUpdatedAt(courtSetupKey)

  let chosen: LoadedCourtSetup | null = local
  let mergeReason = 'local-default'
  if (
    log.setupState?.updatedAt &&
    (preferRemoteSetupState(local, log.setupState, courtSetupKey) || !local)
  ) {
    const fromState = writeCourtSetupFromGameLogState(courtSetupKey, log.setupState, roster)
    if (fromState) {
      chosen = fromState
      mergeReason = 'remote-setup-state'
    }
  } else if (remoteLoaded && preferRemoteSetupState(local, log.setupState, courtSetupKey)) {
    chosen = remoteLoaded
    writeCourtSetupToLocal(courtSetupKey, remoteLoaded, log.setupState?.updatedAt)
    mergeReason = 'remote-loaded-prefer'
  } else if (remoteLoaded && !local) {
    chosen = remoteLoaded
    writeCourtSetupToLocal(courtSetupKey, remoteLoaded, log.setupState?.updatedAt)
    mergeReason = 'remote-loaded-no-local'
  }

  logHydrateDecision(courtSetupKey, 'merge-setup', {
    source: 'mergeServerLogIntoLocalCourt',
    reason: mergeReason,
    padPlayers,
    remote: log,
    localSetup: local,
    localSession,
    chosen,
  })
  // #region agent log
  const chosenSetup = chosen
  const chosenAssignments = chosenSetup
    ? (['TL', 'TR', 'BL', 'BR'] as const)
        .filter((q) => chosenSetup.assignments[q]?.name?.trim())
        .map((q) => ({
          q,
          name: chosenSetup.assignments[q]!.name,
        }))
    : []
  agentDebugIngest(
    'matchReviewHydrate.ts:merge',
    'db/local merge chosen setup',
    {
      runId: 'persist-debug',
      mergeReason,
      chosenPhase: chosen?.setupPhase ?? null,
      chosenAssignmentCount: chosenAssignments.length,
      chosenAssignments,
      remoteSetupPhase: log.setupState?.setupPhase ?? null,
      remoteUpdatedAt: log.setupState?.updatedAt ?? null,
      remoteRosterLen: log.roster.length,
      localPhase: local?.setupPhase ?? null,
      localSetupAt,
      preferRemote: log.setupState ? preferRemoteSetupState(local, log.setupState, courtSetupKey) : false,
    },
    chosen?.setupPhase === 'positions' && (log.setupState?.setupPhase === 'serve' || log.setupState?.setupPhase === 'confirm_serve') ? 'C' : 'A',
  )
  // #endregion

  if (
    log.pointEvents.length > 0 ||
    log.gestures.length > 0 ||
    log.setupState?.serveAttempt ||
    setupLogLength(log.setupState) > readLocalSetupLogLength(courtSetupKey)
  ) {
    if (remoteLogIsAheadOfLocal(courtSetupKey, localSession, log, localSetupAt)) {
      importTimelineFromLog(courtSetupKey, log)
      logHydrateDecision(courtSetupKey, 'merge-timeline', {
        source: 'mergeServerLogIntoLocalCourt',
        reason: 'remote-ahead',
        remote: log,
        localSession,
        chosen,
      })
      if (chosen && log.pointEvents.length > 0) {
        const current = fromGameLogPoint(log.pointEvents[0]!)
        chosen = {
          ...chosen,
          setupPhase: 'ready',
          score: current.scoreAfter,
          matchStartedAt: log.matchStartedAt,
          matchSubmitted: Boolean(log.finalScore && log.matchEndedAt),
        }
        writeCourtSetupToLocal(courtSetupKey, chosen, log.setupState?.updatedAt)
      } else if (chosen && log.setupState?.score) {
        chosen = { ...chosen, score: log.setupState.score }
        writeCourtSetupToLocal(courtSetupKey, chosen, log.setupState?.updatedAt)
      }
    }
  }

  return chosen ?? local
}

/**
 * Seed local storage from a server log (any in-progress or finished game).
 * Returns true if state was restored from the server.
 */
export function hydrateMatchFromServerLog(
  courtSetupKey: string,
  log: MatchGestureLog,
  players: QuadrantPlayers,
): boolean {
  const merged = mergeServerLogIntoLocalCourt(courtSetupKey, log, players)
  return merged != null
}

/**
 * Live sync: merge a newer server log into the local session (committed points
 * + gestures between points). Skips when local is already ahead.
 */
export function applyRemoteLogToSession(
  courtSetupKey: string,
  log: MatchGestureLog,
  padPlayers?: QuadrantPlayers,
): { applied: boolean; score: TennisScore; serveAttempt: 1 | 2 } {
  if (padPlayers) {
    mergeServerLogIntoLocalCourt(courtSetupKey, log, padPlayers)
  }

  const local = loadMatchSession(courtSetupKey)
  const localSetupAt = readLocalSetupUpdatedAt(courtSetupKey)
  const live = restoreLiveMatchFromLocalStorage(courtSetupKey, log.setupState)

  if (!remoteLogIsAheadOfLocal(courtSetupKey, local, log, localSetupAt)) {
    return { applied: false, score: live.score, serveAttempt: live.serveAttempt }
  }

  importTimelineFromLog(courtSetupKey, log)
  const restored = restoreLiveMatchFromLocalStorage(courtSetupKey, log.setupState)
  return { applied: true, score: restored.score, serveAttempt: restored.serveAttempt }
}

/** Build setup_state payload for the next server upsert. */
export function buildSetupStateForSync(
  courtSetupKey: string,
  roster: CourtPlayer[],
  overrides?: Partial<LoadedCourtSetup> & { serveAttempt?: 1 | 2; logStage?: SetupLogStage },
): GameLogSetupState | null {
  const loaded = loadCourtSetup(courtSetupKey, roster)
  if (!loaded && !overrides) return null
  const base = loaded ?? {
    assignments: {},
    setupPhase: 'positions' as const,
    pendingTeamPlacement: null,
    pendingServeQuadrant: null,
    initialServeQuadrant: null,
    score: null,
    matchSubmitted: false,
    matchStartedAt: null,
  }
  const { serveAttempt, logStage, ...setupOverrides } = overrides ?? {}
  const state = setupStateFromLoaded({ ...base, ...setupOverrides }, roster)
  state.setupLog = readLocalSetupLog(courtSetupKey)
  if (serveAttempt) state.serveAttempt = serveAttempt
  return appendSetupLogEntry(state, logStage)
}
