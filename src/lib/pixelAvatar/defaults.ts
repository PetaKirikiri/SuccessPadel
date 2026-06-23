import {
  GAME_CHARACTER_CATALOG,
  gameCharacterById,
  gameCharacterByStanceSrc,
  resolveCharacterPoseSrc,
} from './catalog'
import type { PixelAvatarConfig } from './types'

export const DEFAULT_SHOWDOWN_CHARACTER_ID =
  GAME_CHARACTER_CATALOG[0]?.id ?? 'ryu'

const defaultStance =
  resolveCharacterPoseSrc(DEFAULT_SHOWDOWN_CHARACTER_ID, 'stance') ??
  '/pixel-avatar/showdown/street-fighter/ryu/stance.gif'

export const DEFAULT_PIXEL_AVATAR_REFERENCE = defaultStance

export function defaultPixelAvatarConfig(): PixelAvatarConfig {
  return { v: 1, characterId: DEFAULT_SHOWDOWN_CHARACTER_ID }
}

export function normalizePixelAvatarConfig(raw: unknown): PixelAvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return null

  const rawCharacterId = typeof o.characterId === 'string' ? o.characterId.trim() : ''
  if (rawCharacterId && gameCharacterById(rawCharacterId)) {
    return { v: 1, characterId: rawCharacterId }
  }

  const rawReference = typeof o.reference === 'string' ? o.reference.trim() : ''
  if (rawReference && !rawReference.includes('/pixel-avatar/lpc-parts/')) {
    const fromRef = gameCharacterByStanceSrc(rawReference)?.id
    if (fromRef) return { v: 1, characterId: fromRef, reference: rawReference }
  }

  return { v: 1, characterId: DEFAULT_SHOWDOWN_CHARACTER_ID }
}
