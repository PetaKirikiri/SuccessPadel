import type { CourtPlayer } from './americanoSchedule'
import { resolveGameCharacterIdFromProfile } from './pixelAvatar/resolveCharacterSprite'
import type { ProfileAvatarFields } from './pixelAvatar/types'
import { resolveProfileAvatarUrl } from './resolveProfileAvatar'

export function courtPlayerFromProfile(opts: {
  profileId: string | null
  name: string
  rosterId?: string | null
  padelPlayerId?: string | null
  profile?: ProfileAvatarFields | null
  preferredSide?: CourtPlayer['preferredSide']
}): CourtPlayer {
  const profile = opts.profileId ? opts.profile : null
  return {
    id: opts.profileId,
    rosterId: opts.rosterId ?? null,
    padelPlayerId: opts.padelPlayerId ?? null,
    name: opts.name,
    avatarUrl: profile ? resolveProfileAvatarUrl(profile) : null,
    gameCharacterId: profile ? resolveGameCharacterIdFromProfile(profile.pixel_avatar) : null,
    preferredSide: opts.preferredSide ?? null,
  }
}
