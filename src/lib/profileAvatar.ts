import { supabase } from './supabaseClient'

const MAX_BYTES = 5 * 1024 * 1024
const UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const PICK_TYPES = new Set([...UPLOAD_TYPES, 'image/heic', 'image/heif', ''])

function imageTypeFromFile(file: File): string {
  if (file.type?.startsWith('image/')) return file.type
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic'
  return 'image/jpeg'
}

async function convertImageToJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  try {
    const maxSide = 1200
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process image.')
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    if (!blob) throw new Error('Could not process image.')
    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}

export function validateProfileAvatar(file: File): string | null {
  const type = imageTypeFromFile(file)
  if (!PICK_TYPES.has(type) && !type.startsWith('image/')) {
    return 'Choose a JPG, PNG, or WebP image.'
  }
  if (file.size > MAX_BYTES) return 'Image must be 5 MB or smaller.'
  return null
}

export async function prepareProfileAvatarForUpload(file: File): Promise<File> {
  const validationError = validateProfileAvatar(file)
  if (validationError) throw new Error(validationError)

  const type = imageTypeFromFile(file)
  if (UPLOAD_TYPES.has(type)) return file
  return convertImageToJpeg(file)
}

export async function uploadProfileAvatar(userId: string, file: File): Promise<string> {
  const prepared = await prepareProfileAvatarForUpload(file)
  const ext =
    prepared.type === 'image/png' ? 'png' : prepared.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, prepared, {
    upsert: true,
    contentType: prepared.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

export async function uploadPixelAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/pixel.png`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: 'image/png',
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
    const type = blob.type && UPLOAD_TYPES.has(blob.type) ? blob.type : 'image/jpeg'
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
    const file = new File([blob], `avatar.${ext}`, { type })
    if (file.size > MAX_BYTES) return null
    return await uploadProfileAvatar(userId, file)
  } catch {
    return null
  }
}
