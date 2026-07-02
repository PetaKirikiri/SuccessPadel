import { supabase } from './supabaseClient'

/** Keep padel_players.display_name aligned when a member edits their profile name. */
export async function syncPadelPlayerDisplayName(
  profileId: string,
  displayName: string,
): Promise<void> {
  const trimmed = displayName.trim()
  if (!trimmed) return
  await supabase.from('padel_players').update({ display_name: trimmed }).eq('profile_id', profileId)
}
