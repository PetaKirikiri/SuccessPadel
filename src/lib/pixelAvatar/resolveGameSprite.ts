import type { ShowdownPose } from './catalog'
import { normalizePixelAvatarConfig } from './defaults'
import {
  resolveGameCharacterId,
  resolveGameSpriteForCharacter,
} from './resolveCharacterSprite'
import type { ProfileAvatarFields } from './types'

/** Animated sprite for match-card showdowns (optional; independent of profile photo). */
export function resolveGameSpriteUrl(
  profile: ProfileAvatarFields,
  pose: ShowdownPose = 'stance',
): string | null {
  const config = normalizePixelAvatarConfig(profile.pixel_avatar)
  const characterId = resolveGameCharacterId(config)
  return resolveGameSpriteForCharacter(characterId, pose)
}
