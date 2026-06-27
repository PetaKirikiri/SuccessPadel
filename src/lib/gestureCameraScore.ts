import type { CourtPlayer } from './americanoSchedule'
import type { AmericanoScoringUnit } from './competitionPresets'
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
  scorerProfileId: string
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
  return { ...INITIAL_TENNIS_SCORE }
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
    ? score.gamesA >= score.gamesB
      ? 'a'
      : 'b'
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

function newPointEvent(winner: MatchTeam, scoreAfter: TennisScore): GameLogPoint {
  const id = crypto.randomUUID()
  return {
    at: new Date().toISOString(),
    winner,
    scoreAfter,
    winnerGestureId: id,
    loserGestureId: '',
    winnerQuadrant: '',
    loserQuadrant: '',
    isServe: false,
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
  const log = await loadGestureCameraLog(ctx.courtSetupKey)
  const current = scoreFromLog(log)
  const winner = winnerTeamFromUsThem(ctx.ourTeam, side)
  const scoreAfter = applyTennisPoint(current, winner)
  const pointEvents = [...(log?.pointEvents ?? []), newPointEvent(winner, scoreAfter)]
  const matchEnded = isGestureMatchComplete(scoreAfter, ctx.playTo)
  const payload = buildPayload(ctx, log, scoreAfter, pointEvents, matchEnded)
  const { error } = await upsertMatchGestureLog(payload)
  if (error) return { error, log: null, matchEnded: false }

  if (!ctx.friendly && matchEnded && ctx.roundId) {
    const submitErr = await submitCompetitionFinalScore(
      ctx.roundId,
      ctx.courtId,
      scoreAfter.gamesA,
      scoreAfter.gamesB,
    )
    if (submitErr) return { error: submitErr, log: null, matchEnded: true }
  }

  const updated = await loadGestureCameraLog(ctx.courtSetupKey)
  return { error: null, log: updated, matchEnded }
}

export async function undoGestureCameraPoint(
  ctx: GestureCameraContext,
): Promise<{ error: string | null; log: MatchGestureLog | null }> {
  const log = await loadGestureCameraLog(ctx.courtSetupKey)
  if (!log?.pointEvents.length) return { error: null, log }
  const pointEvents = log.pointEvents.slice(0, -1)
  const scoreAfter = pointEvents.length
    ? pointEvents[pointEvents.length - 1]!.scoreAfter
    : { ...INITIAL_TENNIS_SCORE }
  const payload = buildPayload(ctx, log, scoreAfter, pointEvents, false)
  const { error } = await upsertMatchGestureLog(payload)
  if (error) return { error, log: null }
  const updated = await loadGestureCameraLog(ctx.courtSetupKey)
  return { error: null, log: updated }
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

export function gestureScoreLive(courtSetupKey: string, logs: MatchGestureLog[]): boolean {
  const log = logs.find((row) => row.courtSetupKey === courtSetupKey)
  return Boolean(log && !log.matchEndedAt && log.pointEvents.length > 0)
}
