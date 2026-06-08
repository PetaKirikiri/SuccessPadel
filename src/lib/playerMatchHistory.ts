import { supabase } from './supabaseClient'

export type PlayerMatchHistoryEntry = {
  match_id: string
  played_at: string | null
  score_summary: string
  session_title: string
  round_number: number | null
  court_name: string | null
  won: boolean
  points: number
  teammates: string
  opponents: string
}

function parseEntry(row: unknown): PlayerMatchHistoryEntry | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (typeof r.match_id !== 'string' || typeof r.score_summary !== 'string') return null
  return {
    match_id: r.match_id,
    played_at: typeof r.played_at === 'string' ? r.played_at : null,
    score_summary: r.score_summary,
    session_title: typeof r.session_title === 'string' ? r.session_title : 'Match',
    round_number: typeof r.round_number === 'number' ? r.round_number : null,
    court_name: typeof r.court_name === 'string' ? r.court_name : null,
    won: Boolean(r.won),
    points: typeof r.points === 'number' ? r.points : Number(r.points) || 0,
    teammates: typeof r.teammates === 'string' ? r.teammates : '',
    opponents: typeof r.opponents === 'string' ? r.opponents : '',
  }
}

export async function fetchPlayerMatchHistory(playerId: string): Promise<PlayerMatchHistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_player_match_history', {
    p_player_id: playerId,
  })
  if (error || !Array.isArray(data)) return []
  return data.map(parseEntry).filter((e): e is PlayerMatchHistoryEntry => e != null)
}
