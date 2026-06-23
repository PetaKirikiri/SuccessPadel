import type { PixelAvatarConfig } from '../lib/pixelAvatar/types'
import { resolveCharacterPoseSrc, type ShowdownPose } from '../lib/pixelAvatar/catalog'
import { DEFAULT_PIXEL_AVATAR_REFERENCE, DEFAULT_SHOWDOWN_CHARACTER_ID } from '../lib/pixelAvatar/defaults'

type Props = {
  config: PixelAvatarConfig
  pose?: ShowdownPose
  size?: number
  className?: string
}

export function PixelAvatarRenderer({
  config,
  pose = 'stance',
  size = 64,
  className = '',
}: Props) {
  const characterId = config.characterId?.trim() || DEFAULT_SHOWDOWN_CHARACTER_ID
  const src =
    resolveCharacterPoseSrc(characterId, pose) ??
    resolveCharacterPoseSrc(DEFAULT_SHOWDOWN_CHARACTER_ID, 'stance') ??
    DEFAULT_PIXEL_AVATAR_REFERENCE

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}
