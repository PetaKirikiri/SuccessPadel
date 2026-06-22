import type { ProfileAvatarFields } from './pixelAvatar/types'

/** Profile photo only (LINE upload). Showdown sprites are separate — see resolveGameSpriteUrl. */
export function resolveProfileAvatarUrl(profile: ProfileAvatarFields): string | null {
  return profile.avatar_url?.trim() || null
}
