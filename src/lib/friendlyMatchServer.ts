import type { GestureDebugEntry } from './gestureDebugLog'
import type { MatchSessionRecord } from './matchSessionLog'
import { supabase } from './supabaseClient'

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

export async function saveFriendlyMatchLog(
  courtSetupKey: string,
  session: MatchSessionRecord,
  gestures: GestureDebugEntry[],
): Promise<{ error: string | null }> {
  const { sessionId, gameNumber, courtLabel } = parseFriendlyCourtSetupKey(courtSetupKey)
  if (!session.matchEndedAt || !session.finalScore || !session.winner) {
    return { error: 'Incomplete match session' }
  }

  const { data: live } = await supabase.auth.getSession()
  if (!live.session) return { error: 'Not authenticated' }

  const { error } = await supabase.rpc('save_friendly_match_log', {
    p_friendly_session_id: sessionId,
    p_court_setup_key: courtSetupKey,
    p_game_number: gameNumber,
    p_court_label: courtLabel,
    p_match_started_at: session.matchStartedAt,
    p_match_ended_at: session.matchEndedAt,
    p_final_score: session.finalScore,
    p_winner: session.winner,
    p_player_stats: session.playerStats ?? [],
    p_point_events: session.pointEvents ?? [],
    p_gestures: gestures,
  })

  if (error) {
    console.error('saveFriendlyMatchLog', error.message)
    return { error: error.message }
  }
  return { error: null }
}
