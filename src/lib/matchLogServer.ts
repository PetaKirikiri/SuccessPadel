import type { GestureDebugEntry } from './gestureDebugLog'
import type { GameLogSetupState } from './gameLogSetupState'
import {
  toGameLogGestures,
  toGameLogPoint,
  toGameLogRoster,
  type GameLogGesture,
  type GameLogPayload,
  type GameLogPoint,
  type GameLogRosterSlot,
} from './gameLogSerialize'
import type { MatchSessionRecord, PlayerStatsSnapshot } from './matchSessionLog'
import type { QuadrantPlayers } from './gesturePadPlayers'
import type { MatchTeam } from './types'
import type { TennisScore } from './tennisScore'
import { supabase } from './supabaseClient'

export type MatchGestureLog = {
  courtSetupKey: string
  friendlySessionId: string | null
  competitionId: string | null
  gameNumber: string | null
  courtId: string | null
  matchStartedAt: string
  matchEndedAt: string | null
  finalScore: TennisScore | null
  winner: MatchTeam | null
  playerStats: PlayerStatsSnapshot[]
  pointEvents: GameLogPoint[]
  gestures: GameLogGesture[]
  roster: GameLogRosterSlot[]
  setupState: GameLogSetupState | null
  updatedAt: string | null
}

const UUID_PREFIX =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-(\d+)-(.+))?$/i

export function parseFriendlyCourtSetupKey(key: string): {
  sessionId: string
  gameNumber: number | null
  courtLabel: string | null
} {
  const match = key.match(UUID_PREFIX)
  if (!match) return { sessionId: key, gameNumber: null, courtLabel: null }
  return {
    sessionId: match[1]!,
    gameNumber: match[2] ? Number(match[2]) : null,
    courtLabel: match[3] ?? null,
  }
}

export function buildGameLogPayload(
  courtSetupKey: string,
  session: MatchSessionRecord,
  gestures: GestureDebugEntry[],
  roster: QuadrantPlayers | null,
  opts: {
    isFriendly: boolean
    competitionId?: string
    gameNumber?: string
    courtId?: string
    setupState?: GameLogSetupState
  },
): GameLogPayload {
  const { sessionId } = parseFriendlyCourtSetupKey(courtSetupKey)
  return {
    courtSetupKey,
    friendlySessionId: opts.isFriendly ? sessionId : null,
    competitionId: opts.isFriendly ? null : (opts.competitionId ?? session.competitionId ?? null),
    gameNumber: opts.gameNumber ?? session.gameNumber ?? null,
    courtId: opts.courtId ?? session.courtId ?? null,
    matchStartedAt: session.matchStartedAt,
    matchEndedAt: session.matchEndedAt ?? null,
    finalScore: session.finalScore ?? null,
    winner: session.winner ?? null,
    playerStats: session.playerStats ?? [],
    pointEvents: session.pointEvents.map(toGameLogPoint),
    gestures: toGameLogGestures(gestures),
    roster: toGameLogRoster(roster),
    setupState: opts.setupState ?? {
      updatedAt: session.matchStartedAt,
      setupPhase: 'positions',
      assignments: {},
    },
  }
}

export async function upsertMatchGestureLog(
  payload: GameLogPayload,
): Promise<{ error: string | null }> {
  const { data: live } = await supabase.auth.getSession()
  if (!live.session) return { error: 'Not authenticated' }

  const { error } = await supabase.rpc('upsert_match_gesture_log', {
    p_court_setup_key: payload.courtSetupKey,
    p_friendly_session_id: payload.friendlySessionId,
    p_competition_id: payload.competitionId,
    p_game_number: payload.gameNumber,
    p_court_id: payload.courtId,
    p_match_started_at: payload.matchStartedAt,
    p_match_ended_at: payload.matchEndedAt,
    p_final_score: payload.finalScore,
    p_winner: payload.winner,
    p_player_stats: payload.playerStats,
    p_point_events: payload.pointEvents,
    p_gestures: payload.gestures,
    p_roster: payload.roster,
    p_setup_state: payload.setupState,
  })

  if (error) {
    console.error('upsertMatchGestureLog', error.message)
    return { error: error.message }
  }
  return { error: null }
}

function mapMatchGestureLogRow(data: Record<string, unknown>): MatchGestureLog {
  return {
    courtSetupKey: data.court_setup_key as string,
    friendlySessionId: (data.friendly_session_id as string | null) ?? null,
    competitionId: (data.competition_id as string | null) ?? null,
    gameNumber: (data.game_number as string | null) ?? null,
    courtId: (data.court_id as string | null) ?? null,
    matchStartedAt: data.match_started_at as string,
    matchEndedAt: (data.match_ended_at as string | null) ?? null,
    finalScore: (data.final_score ?? null) as TennisScore | null,
    winner: (data.winner ?? null) as MatchTeam | null,
    playerStats: (data.player_stats ?? []) as PlayerStatsSnapshot[],
    pointEvents: (data.point_events ?? []) as GameLogPoint[],
    gestures: (data.gestures ?? []) as GameLogGesture[],
    roster: (data.roster ?? []) as GameLogRosterSlot[],
    setupState: (data.setup_state ?? null) as GameLogSetupState | null,
    updatedAt: (data.updated_at as string | null) ?? null,
  }
}

/** Read back a stored match log (admin or owner per RLS) by court_setup_key. */
export async function fetchMatchGestureLog(
  courtSetupKey: string,
): Promise<MatchGestureLog | null> {
  const { data, error } = await supabase
    .from('match_gesture_logs')
    .select('*')
    .eq('court_setup_key', courtSetupKey)
    .maybeSingle()

  if (error) {
    console.error('fetchMatchGestureLog', error.message)
    return null
  }
  if (!data) return null
  return mapMatchGestureLogRow(data)
}

/**
 * Latest match log for a friendly session — used when only the session id is
 * known (e.g. the stats page) and the exact court_setup_key isn't.
 */
export async function fetchFriendlySessionMatchLog(
  sessionId: string,
): Promise<MatchGestureLog | null> {
  const { data, error } = await supabase
    .from('match_gesture_logs')
    .select('*')
    .eq('friendly_session_id', sessionId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('fetchFriendlySessionMatchLog', error.message)
    return null
  }
  if (!data) return null
  return mapMatchGestureLogRow(data)
}
