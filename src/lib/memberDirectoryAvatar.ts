import { supabase } from './supabaseClient'
import { prepareProfileAvatarForUpload } from './profileAvatar'

export async function uploadDirectoryAvatar(memberId: string, file: File, ownerToken: string | null): Promise<string> {
  const prepared = await prepareProfileAvatarForUpload(file)
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/member-directory-avatar`, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': prepared.type,
      'x-member-id': memberId,
      ...(ownerToken ? { 'x-directory-owner': ownerToken } : {}),
    },
    body: prepared,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || typeof result.url !== 'string') throw new Error(result.error || 'Photo upload failed. Try again.')
  return result.url
}
