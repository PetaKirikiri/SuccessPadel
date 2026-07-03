import type { ProfileAvatarFields } from './pixelAvatar/types'

/** Profile photo only (LINE upload). Showdown sprites are separate — see resolveGameSpriteUrl. */
export function resolveProfileAvatarUrl(profile: ProfileAvatarFields): string | null {
  return profile.avatar_url?.trim() || null
}

/** Invite chips / roster — photo, pixel render, then LINE padel registry picture. */
export function resolveRosterAvatarUrl(
  profile?: ProfileAvatarFields | null,
  linePictureUrl?: string | null,
): string | null {
  const photo = profile?.avatar_url?.trim()
  if (photo) return photo
  const pixel = profile?.pixel_avatar_url?.trim()
  if (pixel) return pixel
  const line = linePictureUrl?.trim()
  if (line) return line
  return null
}
