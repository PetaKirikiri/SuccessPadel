import { useState } from 'react'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { resolveProfileAvatarUrl } from '../lib/resolveProfileAvatar'
import type { ProfileAvatarFields } from '../lib/pixelAvatar/types'

type Props = {
  displayName: string
  profile?: ProfileAvatarFields | null
  avatarUrl?: string | null
  imgClassName?: string
  pixelated?: boolean
}

export function PlayerAvatar({
  displayName,
  profile,
  avatarUrl: avatarUrlProp,
  imgClassName = 'h-7 w-7 shrink-0 rounded-full object-cover',
  pixelated = false,
}: Props) {
  const [broken, setBroken] = useState(false)
  const name = firstDisplayName(displayName || 'Player')
  const initial = name[0]?.toUpperCase() ?? '?'
  const avatarUrl =
    avatarUrlProp ??
    (profile ? resolveProfileAvatarUrl(profile) : null)

  if (avatarUrl && !broken) {
    return (
      <img
        src={avatarUrl}
        alt=""
        onError={() => setBroken(true)}
        className={imgClassName}
        style={pixelated ? { imageRendering: 'pixelated' } : undefined}
      />
    )
  }

  return (
    <span
      className={`flex items-center justify-center rounded-full bg-brand-primary/10 text-[11px] font-semibold text-brand-primary ${imgClassName}`}
    >
      {initial}
    </span>
  )
}
