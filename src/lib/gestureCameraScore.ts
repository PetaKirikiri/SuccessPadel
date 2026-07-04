import type { CourtPlayer } from './americanoSchedule'
import type { AmericanoScoringUnit } from './competitionPresets'
import { americanoCourtTotals, tennisScoreForManual } from './friendlyManualScore'
import { friendlyCourtSetupKey } from './friendlyCourtLive'
import type { GameLogPoint, GameLogRosterSlot } from './gameLogSerialize'
import type { GameLogSetupState } from './gameLogSetupState'
import {
  fetchMatchGestureLog,
  upsertMatchGestureLog,
  type MatchGestureLog,
} from './matchLogServer'
import type { Quadrant } from './gestureCapture'
import { supabase } from './supabaseClient'
import { agentDebugIngest } from './debug/devDebug'
import type { MatchTeam } from './types'
import {
  applyTennisPoint,
  INITIAL_TENNIS_SCORE,
  type TennisScore,
} from './tennisScore'

export type GestureCameraSetupState = GameLogSetupState & {
  scoringMode?: 'camera'
  scorerProfileId?: string
  ourTeam?: MatchTeam
  /** Human typed games — points history before this is discarded. */
  gamesManualOverrideAt?: string
}

export const MANUAL_GAMES_GESTURE_ID = 'manual-games'
export const MANUAL_POINTS_GESTURE_ID = 'manual-points'

export function gamesManualOverrideAt(log: MatchGestureLog | null): string | undefined {
  if (!log) return undefined
  const fromSetup = (log.setupState as GestureCameraSetupState | null)?.gamesManualOverrideAt
  if (fromSetup) return fromSetup
  const last = log.pointEvents[log.pointEvents.length - 1]
  if (last?.winnerGestureId === MANUAL_GAMES_GESTURE_ID) return last.at
  return undefined
}

function buildManualCourtScoreEvents(
  teamA: number,
  teamB: number,
  scoreUnit: AmericanoScoringUnit,
  now: string,
): GameLogPoint[] {
  const events: GameLogPoint[] = []
  let a = 0
  let b = 0
  const scoreAfter = (): TennisScore => tennisScoreForManual(a, b, scoreUnit)
  const push = (winner: MatchTeam) => {
    if (winner === 'a') a += 1
    else b += 1
    events.push({
      at: now,
      winner,
      scoreAfter: scoreAfter(),
      winnerGestureId: MANUAL_GAMES_GESTURE_ID,
      loserGestureId: '',
      winnerQuadrant: '',
      loserQuadrant: '',
      isServe: false,
    })
  }
  for (let i = 0; i < teamA; i += 1) push('a')
  for (let i = 0; i < teamB; i += 1) push('b')
  if (!events.length) {
    events.push({
      at: now,
      winner: 'a',
      scoreAfter: tennisScoreForManual(0, 0, scoreUnit),
      winnerGestureId: MANUAL_GAMES_GESTURE_ID,
      loserGestureId: '',
      winnerQuadrant: '',
      loserQuadrant: '',
      isServe: false,
    })
  }
  return events
}

function isManualCourtMatchComplete(
  score: TennisScore,
  playTo: number | undefined,
  scoreUnit: AmericanoScoringUnit,
): boolean {
  if (!playTo || playTo < 1) return false
  const [a, b] = americanoCourtTotals(score, scoreUnit)
  return a >= playTo || b >= playTo
}

export type GestureCameraContext = {
  courtSetupKey: string
  friendly: boolean
  friendlySessionId?: string
  competitionId?: string
  gameNumber: number
  courtId: string
  courtLabel: string
  roundId?: string
  playTo?: number
  scoreUnit: AmericanoScoringUnit
  roster: GameLogRosterSlot[]
  ourTeam: MatchTeam
  scorerProfileId?: string
}

export function competitionCourtSetupKey(
  competitionId: string,
  gameNumber: number,
  courtId: string,
): string {
  return `${competitionId}-${gameNumber}-${courtId}`
}

export function friendlyGestureCourtSetupKey(
  sessionId: string,
  gameNumber: number,
  courtLabel: string,
): string {
  return friendlyCourtSetupKey(sessionId, gameNumber, courtLabel)
}

export function ourTeamFromCourtPlayers(
  currentUserId: string | null | undefined,
  teamAPlayers?: CourtPlayer[],
  teamBPlayers?: CourtPlayer[],
): MatchTeam | null {
  if (!currentUserId) return null
  if (teamAPlayers?.some((player) => player.id === currentUserId)) return 'a'
  if (teamBPlayers?.some((player) => player.id === currentUserId)) return 'b'
  return null
}

export function rosterFromCourt(
  teamAPlayers?: CourtPlayer[],
  teamBPlayers?: CourtPlayer[],
): GameLogRosterSlot[] {
  const quads: Quadrant[] = ['TL', 'TR', 'BL', 'BR']
  const players = [teamAPlayers?.[0], teamAPlayers?.[1], teamBPlayers?.[0], teamBPlayers?.[1]]
  return quads.map((quadrant, i) => ({
    quadrant,
    playerId: players[i]?.id ?? null,
    name: players[i]?.name ?? '',
  }))
}

export function scoreFromLog(log: MatchGestureLog | null): TennisScore {
  if (!log) return { ...INITIAL_TENNIS_SCORE }
  const last = log.pointEvents[log.pointEvents.length - 1]
  if (last?.scoreAfter) return { ...last.scoreAfter }
  if (log.setupState?.score) return { ...log.setupState.score }
  if (log.finalScore) return { ...log.finalScore }
  return { ...INITIAL_TENNIS_SCORE }
}

function setupScoringMode(log: MatchGestureLog | null): string | undefined {
  const state = log?.setupState as GestureCameraSetupState | null | undefined
  return state?.scoringMode
}

export function isGestureCameraCourtLog(log: MatchGestureLog | null | undefined): boolean {
  return setupScoringMode(log ?? null) === 'camera'
}

/** Manual one-shot court scores should not block live gesture scoring. */
export function gestureCameraMatchEnded(log: MatchGestureLog | null): boolean {
  if (!log?.matchEndedAt) return false
  if (log.pointEvents.length === 0 && setupScoringMode(log) !== 'camera') return false
  return true
}

function isManualOnlyCourtLog(log: MatchGestureLog | null): boolean {
  return Boolean(log?.matchEndedAt && log.pointEvents.length === 0 && setupScoringMode(log) !== 'camera')
}

export function ourThemFromScore(score: TennisScore, ourTeam: MatchTeam) {
  const ourIsA = ourTeam === 'a'
  return {
    ourPoints: ourIsA ? score.pointsA : score.pointsB,
    theirPoints: ourIsA ? score.pointsB : score.pointsA,
    ourGames: ourIsA ? score.gamesA : score.gamesB,
    theirGames: ourIsA ? score.gamesB : score.gamesA,
  }
}

export function winnerTeamFromUsThem(ourTeam: MatchTeam, side: 'us' | 'them'): MatchTeam {
  if (side === 'us') return ourTeam
  return ourTeam === 'a' ? 'b' : 'a'
}

export function isGestureMatchComplete(score: TennisScore, playTo?: number): boolean {
  if (!playTo || playTo < 1) return false
  return score.gamesA >= playTo || score.gamesB >= playTo
}

function cameraSetupState(
  ctx: GestureCameraContext,
  score: TennisScore,
  matchEnded: boolean,
): GestureCameraSetupState {
  const now = new Date().toISOString()
  return {
    updatedAt: now,
    setupPhase: matchEnded ? 'ready' : 'ready',
    assignments: {},
    score,
    matchStartedAt: now,
    matchSubmitted: matchEnded,
    scoringMode: 'camera',
    scorerProfileId: ctx.scorerProfileId,
    ourTeam: ctx.ourTeam,
  }
}

function buildPayload(
  ctx: GestureCameraContext,
  log: MatchGestureLog | null,
  score: TennisScore,
  pointEvents: GameLogPoint[],
  matchEnded: boolean,
): Parameters<typeof upsertMatchGestureLog>[0] {
  const now = new Date().toISOString()
  const winner: MatchTeam | null = matchEnded
    ? (() => {
        const [teamA, teamB] = americanoCourtTotals(score, ctx.scoreUnit)
        return teamA >= teamB ? 'a' : 'b'
      })()
    : null
  const startedAt = log?.matchStartedAt ?? now
  return {
    courtSetupKey: ctx.courtSetupKey,
    friendlySessionId: ctx.friendly ? (ctx.friendlySessionId ?? null) : null,
    competitionId: ctx.friendly ? null : (ctx.competitionId ?? null),
    gameNumber: String(ctx.gameNumber),
    courtId: ctx.courtId,
    matchStartedAt: startedAt,
    matchEndedAt: matchEnded ? now : null,
    finalScore: matchEnded ? score : score,
    winner,
    playerStats: log?.playerStats ?? [],
    pointEvents,
    gestures: log?.gestures ?? [],
    roster: ctx.roster,
    setupState: cameraSetupState(ctx, score, matchEnded),
  }
}

function newPointEvent(
  winner: MatchTeam,
  scoreBefore: TennisScore,
  scoreAfter: TennisScore,
): GameLogPoint {
  const id = crypto.randomUUID()
  const gameWon =
    scoreAfter.gamesA > scoreBefore.gamesA || scoreAfter.gamesB > scoreBefore.gamesB
  return {
    at: new Date().toISOString(),
    winner,
    scoreAfter,
    ...(gameWon ? { scoreBefore: { ...scoreBefore } } : {}),
    winnerGestureId: id,
    loserGestureId: '',
    winnerQuadrant: '',
    loserQuadrant: '',
    isServe: false,
  }
}

function snapshotLog(
  ctx: GestureCameraContext,
  scoreAfter: TennisScore,
  pointEvents: GameLogPoint[],
  matchEnded: boolean,
  prior: MatchGestureLog | null,
): MatchGestureLog {
  const now = new Date().toISOString()
  return {
    courtSetupKey: ctx.courtSetupKey,
    friendlySessionId: ctx.friendly ? (ctx.friendlySessionId ?? null) : null,
    competitionId: ctx.friendly ? null : (ctx.competitionId ?? null),
    gameNumber: String(ctx.gameNumber),
    courtId: ctx.courtId,
    matchStartedAt: prior?.matchStartedAt ?? now,
    matchEndedAt: matchEnded ? now : null,
    finalScore: scoreAfter,
    winner: matchEnded ? (scoreAfter.gamesA >= scoreAfter.gamesB ? 'a' : 'b') : null,
    playerStats: prior?.playerStats ?? [],
    pointEvents,
    gestures: prior?.gestures ?? [],
    roster: ctx.roster,
    setupState: cameraSetupState(ctx, scoreAfter, matchEnded),
    updatedAt: now,
  }
}

export async function loadGestureCameraLog(
  courtSetupKey: string,
): Promise<MatchGestureLog | null> {
  return fetchMatchGestureLog(courtSetupKey)
}

export async function syncGestureCameraPoint(
  ctx: GestureCameraContext,
  side: 'us' | 'them',
): Promise<{ error: string | null; log: MatchGestureLog | null; matchEnded: boolean }> {
  const winner = winnerTeamFromUsThem(ctx.ourTeam, side)
  return syncGestureCameraPointForTeam(ctx, winner)
}

export function planGestureCameraPoint(
  ctx: GestureCameraContext,
  priorLog: MatchGestureLog | null,
  winner: MatchTeam,
): { log: MatchGestureLog; matchEnded: boolean } {
  const manualOnly = isManualOnlyCourtLog(priorLog)
  const current = manualOnly ? { ...INITIAL_TENNIS_SCORE } : scoreFromLog(priorLog)
  const scoreAfter = applyTennisPoint(current, winner)
  const priorEvents = manualOnly ? [] : (priorLog?.pointEvents ?? [])
  const pointEvents = [...priorEvents, newPointEvent(winner, current, scoreAfter)]
  const matchEnded = isGestureMatchComplete(scoreAfter, ctx.playTo)
  const log = snapshotLog(ctx, scoreAfter, pointEvents, matchEnded, manualOnly ? null : priorLog)
  return { log, matchEnded }
}

/** Human games edit: court match totals are authoritative; reset live tennis points. */
export function planGestureCameraGamesOverride(
  ctx: GestureCameraContext,
  priorLog: MatchGestureLog | null,
  gamesA: number,
  gamesB: number,
): { log: MatchGestureLog; matchEnded: boolean } | null {
  const targetA = Math.max(0, Math.floor(gamesA))
  const targetB = Math.max(0, Math.floor(gamesB))
  const scoreAfter = tennisScoreForManual(targetA, targetB, ctx.scoreUnit)
  const current = scoreFromLog(priorLog)
  const [curA, curB] = americanoCourtTotals(current, ctx.scoreUnit)
  if (curA === targetA && curB === targetB) {
    const tennisCleared = current.pointsA === 0 && current.pointsB === 0
    if ((ctx.scoreUnit === 'games' && tennisCleared) || ctx.scoreUnit === 'points') return null
  }

  const now = new Date().toISOString()
  const pointEvents = buildManualCourtScoreEvents(targetA, targetB, ctx.scoreUnit, now)
  const matchEnded = isManualCourtMatchComplete(scoreAfter, ctx.playTo, ctx.scoreUnit)
  const log = snapshotLog(ctx, scoreAfter, pointEvents, matchEnded, priorLog)
  const setup = log.setupState as GestureCameraSetupState
  setup.gamesManualOverrideAt = now
  return { log, matchEnded }
}

export async function syncGestureCameraGamesOverride(
  ctx: GestureCameraContext,
  gamesA: number,
  gamesB: number,
  priorLog?: MatchGestureLog | null,
): Promise<{ error: string | null; log: MatchGestureLog | null; matchEnded: boolean; saved: boolean }> {
  const prior = priorLog !== undefined ? priorLog : await loadGestureCameraLog(ctx.courtSetupKey)
  const planned = planGestureCameraGamesOverride(ctx, prior, gamesA, gamesB)
  if (!planned) {
    return {
      error: null,
      log: prior,
      matchEnded: gestureCameraPlayEnded(prior, ctx.playTo),
      saved: false,
    }
  }

  const { log, matchEnded } = planned
  const manualOnly = isManualOnlyCourtLog(prior)
  const payload = buildPayload(
    ctx,
    manualOnly ? null : prior,
    log.finalScore!,
    log.pointEvents,
    matchEnded,
  )
  const { error } = await upsertMatchGestureLog(payload)
  if (error) {
    // #region agent log
    agentDebugIngest(
      'gestureCameraScore.ts:syncGestureCameraGamesOverride',
      'upsert error',
      { error, scoreUnit: ctx.scoreUnit, finalScore: log.finalScore },
      'B',
      '5d6061',
    )
    // #endregion
    return { error, log: null, matchEnded: false, saved: false }
  }

  if (!ctx.friendly && ctx.roundId) {
    const [teamA, teamB] = americanoCourtTotals(log.finalScore!, ctx.scoreUnit)
    const submitErr = await submitCompetitionFinalScore(ctx.roundId, ctx.courtId, teamA, teamB)
    if (submitErr) {
      // #region agent log
      agentDebugIngest(
        'gestureCameraScore.ts:syncGestureCameraGamesOverride',
        'competition RPC error',
        { submitErr, teamA, teamB, roundId: ctx.roundId, courtId: ctx.courtId },
        'D',
        '5d6061',
      )
      // #endregion
      return { error: submitErr, log: null, matchEnded, saved: false }
    }
  }

  // #region agent log
  agentDebugIngest(
    'gestureCameraScore.ts:syncGestureCameraGamesOverride',
    'saved ok',
    {
      scoreUnit: ctx.scoreUnit,
      finalScore: log.finalScore,
      totals: americanoCourtTotals(log.finalScore!, ctx.scoreUnit),
      friendly: ctx.friendly,
      roundId: ctx.roundId,
      rosterLen: log.roster.length,
    },
    'C',
    '5d6061',
  )
  // #endregion
  return { error: null, log, matchEnded, saved: true }
}

/** Human points edit: keep games, set tennis points for dispute / backup entry. */
export function planGestureCameraPointsOverride(
  ctx: GestureCameraContext,
  priorLog: MatchGestureLog | null,
  pointsA: number,
  pointsB: number,
): { log: MatchGestureLog; matchEnded: boolean } | null {
  const current = scoreFromLog(priorLog)
  const scoreAfter: TennisScore = {
    pointsA: Math.max(0, Math.min(3, Math.floor(pointsA))),
    pointsB: Math.max(0, Math.min(3, Math.floor(pointsB))),
    gamesA: current.gamesA,
    gamesB: current.gamesB,
  }
  if (current.pointsA === scoreAfter.pointsA && current.pointsB === scoreAfter.pointsB) {
    return null
  }

  const now = new Date().toISOString()
  const pointEvents: GameLogPoint[] = [
    {
      at: now,
      winner: scoreAfter.pointsA >= scoreAfter.pointsB ? 'a' : 'b',
      scoreAfter,
      winnerGestureId: MANUAL_POINTS_GESTURE_ID,
      loserGestureId: '',
      winnerQuadrant: '',
      loserQuadrant: '',
      isServe: false,
    },
  ]
  const matchEnded = isGestureMatchComplete(scoreAfter, ctx.playTo)
  const log = snapshotLog(ctx, scoreAfter, pointEvents, matchEnded, priorLog)
  return { log, matchEnded }
}

export async function syncGestureCameraPointsOverride(
  ctx: GestureCameraContext,
  pointsA: number,
  pointsB: number,
  priorLog?: MatchGestureLog | null,
): Promise<{ error: string | null; log: MatchGestureLog | null; matchEnded: boolean }> {
  const prior = priorLog !== undefined ? priorLog : await loadGestureCameraLog(ctx.courtSetupKey)
  const planned = planGestureCameraPointsOverride(ctx, prior, pointsA, pointsB)
  if (!planned) return { error: null, log: prior, matchEnded: gestureCameraPlayEnded(prior, ctx.playTo) }

  const { log, matchEnded } = planned
  const manualOnly = isManualOnlyCourtLog(prior)
  const payload = buildPayload(
    ctx,
    manualOnly ? null : prior,
    log.finalScore!,
    log.pointEvents,
    matchEnded,
  )
  const { error } = await upsertMatchGestureLog(payload)
  if (error) return { error, log: null, matchEnded: false }

  if (!ctx.friendly && matchEnded && ctx.roundId) {
    const submitErr = await submitCompetitionFinalScore(
      ctx.roundId,
      ctx.courtId,
      log.finalScore!.gamesA,
      log.finalScore!.gamesB,
    )
    if (submitErr) return { error: submitErr, log: null, matchEnded: true }
  }

  return { error: null, log, matchEnded }
}

export function planGestureCameraUndo(
  ctx: GestureCameraContext,
  priorLog: MatchGestureLog | null,
): MatchGestureLog | null {
  if (!priorLog?.pointEvents.length) return priorLog
  const pointEvents = priorLog.pointEvents.slice(0, -1)
  const scoreAfter = pointEvents.length
    ? pointEvents[pointEvents.length - 1]!.scoreAfter
    : { ...INITIAL_TENNIS_SCORE }
  return snapshotLog(ctx, scoreAfter, pointEvents, false, priorLog)
}

export async function syncGestureCameraPointForTeam(
  ctx: GestureCameraContext,
  winner: MatchTeam,
  priorLog?: MatchGestureLog | null,
): Promise<{ error: string | null; log: MatchGestureLog | null; matchEnded: boolean }> {
  const prior = priorLog !== undefined ? priorLog : await loadGestureCameraLog(ctx.courtSetupKey)
  const { log, matchEnded } = planGestureCameraPoint(ctx, prior, winner)
  const manualOnly = isManualOnlyCourtLog(prior)
  const payload = buildPayload(
    ctx,
    manualOnly ? null : prior,
    log.finalScore!,
    log.pointEvents,
    matchEnded,
  )
  const { error } = await upsertMatchGestureLog(payload)
  if (error) return { error, log: null, matchEnded: false }

  if (!ctx.friendly && matchEnded && ctx.roundId) {
    const submitErr = await submitCompetitionFinalScore(
      ctx.roundId,
      ctx.courtId,
      log.finalScore!.gamesA,
      log.finalScore!.gamesB,
    )
    if (submitErr) return { error: submitErr, log: null, matchEnded: true }
  }

  return { error: null, log, matchEnded }
}

/** Persist a log already planned client-side — avoids replanning from stale prior. */
export async function persistPlannedGestureCameraLog(
  ctx: GestureCameraContext,
  prior: MatchGestureLog | null,
  planned: MatchGestureLog,
  matchEnded: boolean,
): Promise<{ error: string | null; log: MatchGestureLog | null; matchEnded: boolean }> {
  const manualOnly = isManualOnlyCourtLog(prior)
  const payload = buildPayload(
    ctx,
    manualOnly ? null : prior,
    planned.finalScore!,
    planned.pointEvents,
    matchEnded,
  )
  const { error } = await upsertMatchGestureLog(payload)
  if (error) return { error, log: null, matchEnded: false }

  if (!ctx.friendly && matchEnded && ctx.roundId) {
    const score = planned.finalScore!
    const submitErr = await submitCompetitionFinalScore(
      ctx.roundId,
      ctx.courtId,
      score.gamesA,
      score.gamesB,
    )
    if (submitErr) return { error: submitErr, log: null, matchEnded: true }
  }

  return { error: null, log: planned, matchEnded }
}

export async function undoGestureCameraPoint(
  ctx: GestureCameraContext,
  priorLog?: MatchGestureLog | null,
): Promise<{ error: string | null; log: MatchGestureLog | null }> {
  const prior = priorLog !== undefined ? priorLog : await loadGestureCameraLog(ctx.courtSetupKey)
  const log = planGestureCameraUndo(ctx, prior)
  if (!log || log === prior) return { error: null, log: prior }
  const payload = buildPayload(ctx, prior, log.finalScore!, log.pointEvents, false)
  const { error } = await upsertMatchGestureLog(payload)
  if (error) return { error, log: null }
  return { error: null, log }
}

export async function ensureGestureCameraSession(
  ctx: GestureCameraContext,
): Promise<{ error: string | null; log: MatchGestureLog | null }> {
  const prior = await loadGestureCameraLog(ctx.courtSetupKey)
  if (prior && isGestureCameraCourtLog(prior) && !gestureCameraMatchEnded(prior)) {
    return { error: null, log: prior }
  }
  if (prior && !isManualOnlyCourtLog(prior) && prior.pointEvents.length > 0 && !isGestureCameraCourtLog(prior)) {
    return { error: null, log: prior }
  }
  const score = isManualOnlyCourtLog(prior) ? { ...INITIAL_TENNIS_SCORE } : scoreFromLog(prior)
  const pointEvents = isManualOnlyCourtLog(prior) ? [] : (prior?.pointEvents ?? [])
  const payload = buildPayload(ctx, isManualOnlyCourtLog(prior) ? null : prior, score, pointEvents, false)
  const { error } = await upsertMatchGestureLog(payload)
  if (error) return { error, log: null }
  const log = await loadGestureCameraLog(ctx.courtSetupKey)
  return { error: null, log }
}

export async function resetGestureCameraLog(
  ctx: GestureCameraContext,
): Promise<{ error: string | null }> {
  const log = await loadGestureCameraLog(ctx.courtSetupKey)
  const payload = buildPayload(ctx, log, { ...INITIAL_TENNIS_SCORE }, [], false)
  return upsertMatchGestureLog(payload)
}

export async function submitCompetitionFinalScore(
  roundId: string,
  courtId: string,
  teamA: number,
  teamB: number,
): Promise<string | null> {
  const winTeam = teamA >= teamB ? 'a' : 'b'
  const { error } = await supabase.rpc('record_competition_match', {
    p_round_id: roundId,
    p_court_id: courtId,
    p_score_summary: `${teamA}-${teamB}`,
    p_winner_team: winTeam,
    p_margin_bonus: false,
    p_team_a_points: teamA,
    p_team_b_points: teamB,
  })
  return error?.message ?? null
}

export function gestureCameraPlayEnded(
  log: MatchGestureLog | null,
  playTo?: number,
): boolean {
  if (!log || !playTo || playTo < 1) return false
  return isGestureMatchComplete(scoreFromLog(log), playTo)
}

export function gestureScoreLive(courtSetupKey: string, logs: MatchGestureLog[]): boolean {
  const log = logs.find((row) => row.courtSetupKey === courtSetupKey)
  return Boolean(log && !log.matchEndedAt && isGestureCameraCourtLog(log))
}
