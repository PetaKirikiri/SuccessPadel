import type { AvatarMode, PixelAvatarConfig } from '../types'

export type { AvatarMode, PixelAvatarConfig } from '../types'

export type ProfileAvatarFields = {
  avatar_url: string | null
  avatar_mode?: AvatarMode | null
  pixel_avatar?: PixelAvatarConfig | null
  pixel_avatar_url?: string | null
}
