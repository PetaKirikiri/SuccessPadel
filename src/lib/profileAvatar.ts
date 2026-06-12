import { supabase } from './supabaseClient'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateProfileAvatar(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return 'Choose a JPG, PNG, or WebP image.'
  if (file.size > MAX_BYTES) return 'Image must be 5 MB or smaller.'
  return null
}

export async function uploadProfileAvatar(userId: string, file: File): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

/** Copy a LINE CDN photo into our avatars bucket so the URL stays valid. */
export async function mirrorLineAvatarToStorage(
  userId: string,
  linePictureUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(linePictureUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    const type = blob.type && ALLOWED_TYPES.has(blob.type) ? blob.type : 'image/jpeg'
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
    const file = new File([blob], `avatar.${ext}`, { type })
    if (file.size > MAX_BYTES) return null
    return await uploadProfileAvatar(userId, file)
  } catch {
    return null
  }
}

