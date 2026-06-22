import type { PixelAvatarConfig } from '../lib/pixelAvatar/types'
import { DEFAULT_PIXEL_AVATAR_REFERENCE } from '../lib/pixelAvatar/defaults'

type Props = {
  config: PixelAvatarConfig
  size?: number
  className?: string
}

export function PixelAvatarRenderer({ config, size = 64, className = '' }: Props) {
  return (
    <img
      src={config.reference || DEFAULT_PIXEL_AVATAR_REFERENCE}
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}
