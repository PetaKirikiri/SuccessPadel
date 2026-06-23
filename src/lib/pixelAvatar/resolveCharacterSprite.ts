import type { PixelAvatarConfig } from './types'
import { gameCharacterByStanceSrc, resolveCharacterPoseSrc, type ShowdownPose } from './catalog'
import { normalizePixelAvatarConfig } from './defaults'

export function resolveGameCharacterId(config: PixelAvatarConfig | null | undefined): string | null {
  if (!config) return null
  if (config.characterId?.trim()) return config.characterId.trim()
  if (config.reference?.trim()) {
    return gameCharacterByStanceSrc(config.reference.trim())?.id ?? null
  }
  return null
}

export function resolveGameCharacterIdFromProfile(
  pixelAvatar: unknown,
): string | null {
  return resolveGameCharacterId(normalizePixelAvatarConfig(pixelAvatar))
}

export function resolveGameSpriteForCharacter(
  characterId: string | null | undefined,
  pose: ShowdownPose = 'stance',
): string | null {
  if (!characterId?.trim()) return null
  return resolveCharacterPoseSrc(characterId.trim(), pose)
}
