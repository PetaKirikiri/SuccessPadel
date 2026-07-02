import { supabase } from '../supabaseClient'
import { syncLineProfileFromLiff } from './profileSync'

/** Re-handshake LINE photo for the signed-in user (LIFF / in-app only). */
export async function refreshLineAvatarForCurrentUser(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const synced = await syncLineProfileFromLiff(user.id)
  if (!synced) return null

  const { data } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return data?.avatar_url?.trim() || null
}
