import { normalizePixelAvatarConfig } from './defaults'
import type { ProfileAvatarFields } from './types'

/** Animated sprite for match-card showdowns (optional; independent of profile photo). */
export function resolveGameSpriteUrl(profile: ProfileAvatarFields): string | null {
  const config = normalizePixelAvatarConfig(profile.pixel_avatar)
  const reference = config?.reference?.trim()
  return reference || null
}
