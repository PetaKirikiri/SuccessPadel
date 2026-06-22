import type { PixelAvatarConfig } from './types'

export const DEFAULT_PIXEL_AVATAR_REFERENCE = '/pixel-avatar/fighter-test/ryu.gif'

export function defaultPixelAvatarConfig(): PixelAvatarConfig {
  return { v: 1, reference: DEFAULT_PIXEL_AVATAR_REFERENCE }
}

export function normalizePixelAvatarConfig(raw: unknown): PixelAvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return null
  const rawReference = typeof o.reference === 'string' ? o.reference : DEFAULT_PIXEL_AVATAR_REFERENCE
  const reference = rawReference.includes('/pixel-avatar/lpc-parts/')
    ? DEFAULT_PIXEL_AVATAR_REFERENCE
    : rawReference
  return { v: 1, reference }
}
