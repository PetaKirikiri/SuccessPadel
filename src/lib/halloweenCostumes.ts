import { supabase } from './supabaseClient'
export type HalloweenCostume = {
  roster_id: string; subject_key: string; player_id: string | null; profile_id: string | null
  display_name: string; description: string; revision: number; portrait_url: string | null
  updated_at: string | null; needs_avatar: boolean
}
export async function loadHalloweenCostumes(sessionId: string, token: string | null): Promise<HalloweenCostume[]> {
  const { data, error } = await supabase.rpc('list_halloween_costumes', { p_session_id: sessionId, p_access_token: token })
  if (error) throw error
  return (data ?? []) as HalloweenCostume[]
}
export async function saveHalloweenCostume(sessionId: string, costume: HalloweenCostume, description: string, token: string | null): Promise<HalloweenCostume> {
  const { data, error } = await supabase.rpc('save_halloween_costume', {
    p_session_id: sessionId, p_roster_id: costume.roster_id, p_subject_key: costume.subject_key,
    p_description: description, p_expected_revision: costume.revision, p_access_token: token,
  })
  if (error) throw error
  return { ...costume, ...data, needs_avatar: Boolean(data.description) && (!data.portrait_url || data.portrait_revision !== data.revision) }
}
