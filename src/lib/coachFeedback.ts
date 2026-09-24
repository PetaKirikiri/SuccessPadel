import { supabase } from './supabaseClient'

export type CoachObservation = {
  category: string; skill: string; kind: 'strength' | 'improvement' | 'observation'
  observation: string; next_step: string; evidence: string
  /** Absent on historical notes; never treat an unassessed skill as zero. */
  rating?: number | null
  rating_source?: 'coach' | 'estimated' | null
}
export type CoachEntry = {
  id: string; player_id: string; coach_id?: string; created_at: string; transcript: string
  feedback: { observations: CoachObservation[] }
  coach: { display_name: string } | null
}
export async function loadCoachEntries(playerId: string, competitionId?: string): Promise<CoachEntry[]> {
  const rows: Omit<CoachEntry, 'coach'>[] = []
  let cursor: Omit<CoachEntry, 'coach'> | undefined
  // Keyset pagination preserves the full history, even while new notes arrive.
  for (;;) {
    let query = supabase.from('player_coach_observations')
      .select('id,player_id,coach_id,created_at,transcript,feedback')
      .eq('player_id', playerId).eq('status', 'complete')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100)
    if (competitionId) query = query.eq('competition_id', competitionId)
    if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
    const { data, error } = await query
    if (error) throw new Error('Could not load coach feedback. Please try again.')
    const page = (data ?? []) as unknown as Omit<CoachEntry, 'coach'>[]
    rows.push(...page)
    if (page.length < 100) break
    cursor = page[page.length - 1]
  }
  // profiles table joins are not public. Resolve attribution through the same
  // existing public profile endpoint used by player pages, without widening RLS.
  const coachIds = [...new Set(rows.flatMap(row => row.coach_id ? [row.coach_id] : []))]
  const coaches = new Map(await Promise.all(coachIds.map(async id => {
    const { data: profile } = await supabase.rpc('get_player_profile', { p_profile_id: id })
    const name = profile && typeof profile === 'object' && 'display_name' in profile
      && typeof profile.display_name === 'string' ? profile.display_name : null
    return [id, name ? { display_name: name } : null] as const
  })))
  return rows.map(row => ({ ...row, coach: row.coach_id ? coaches.get(row.coach_id) ?? null : null }))
}
export async function deleteCoachEntry(id: string, playerId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in with your coach account to delete feedback.')
  const { data, error } = await supabase.from('player_coach_observations').delete()
    .eq('id', id).eq('player_id', playerId).eq('coach_id', session.user.id)
    .eq('status', 'complete').select('id')
  if (error || data?.length !== 1) throw new Error('Could not delete this note. It may already be deleted, or you no longer have permission.')
}
export async function sendCoachRecording(input: { id: string; playerId: string; competitionId: string | null; blob: Blob; seconds: number }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in with your staff account to send feedback.')
  const bytes = new Uint8Array(await input.blob.arrayBuffer())
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Recording is too large. Please record a shorter note.')
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  const response = await fetch('/api/coach-feedback', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ id: input.id, playerId: input.playerId, competitionId: input.competitionId,
      seconds: input.seconds, mime: input.blob.type.split(';')[0], audio: btoa(binary) }),
    signal: AbortSignal.timeout(175000),
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The recording server is not available on this version yet.')
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not save feedback. Please retry.')
  return result as { id: string; transcript: string; feedback: { observations: CoachObservation[] } }
}
