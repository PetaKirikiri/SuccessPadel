import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { firstDisplayName } from '../../lib/leaderboardEntries'
import { refreshLineAvatarForCurrentUser } from '../../lib/line/refreshLineAvatar'
import { isHostedAvatarUrl, isLineCdnAvatarUrl } from '../../lib/lineAvatar'
import { resolveProfileAvatarUrl } from '../../lib/resolveProfileAvatar'
import type { ProfileAvatarFields } from '../../lib/pixelAvatar/types'

type Props = {
  displayName: string
  profile?: ProfileAvatarFields | null
  avatarUrl?: string | null
  profileId?: string | null
  imgClassName?: string
  pixelated?: boolean
}

function withCacheBust(url: string): string {
  const joiner = url.includes('?') ? '&' : '?'
  return `${url}${joiner}v=${Date.now()}`
}

export function PlayerAvatar({
  displayName,
  profile,
  avatarUrl: avatarUrlProp,
  profileId,
  imgClassName = 'h-7 w-7 shrink-0 rounded-full object-cover',
  pixelated = false,
}: Props) {
  const { user, profile: authProfile } = useAuth()
  const [broken, setBroken] = useState(false)
  const [src, setSrc] = useState<string | null>(
    avatarUrlProp ?? (profile ? resolveProfileAvatarUrl(profile) : null),
  )
  const recoveryRef = useRef<'none' | 'bust' | 'handshake'>('none')

  const name = firstDisplayName(displayName || 'Player')
  const initial = name[0]?.toUpperCase() ?? '?'
  const resolvedUrl = avatarUrlProp ?? (profile ? resolveProfileAvatarUrl(profile) : null)

  useEffect(() => {
    setSrc(resolvedUrl)
    setBroken(false)
    recoveryRef.current = 'none'
  }, [resolvedUrl])

  const handleError = () => {
    const current = src ?? resolvedUrl
    if (!current) {
      setBroken(true)
      return
    }

    const isOwnLineProfile = Boolean(
      profileId && user?.id === profileId && authProfile?.line_user_id,
    )

    if (recoveryRef.current === 'none' && isLineCdnAvatarUrl(current)) {
      recoveryRef.current = 'bust'
      setSrc(withCacheBust(current))
      return
    }

    if (recoveryRef.current !== 'handshake' && isOwnLineProfile) {
      recoveryRef.current = 'handshake'
      void refreshLineAvatarForCurrentUser().then((freshUrl) => {
        if (freshUrl) {
          setSrc(freshUrl)
          setBroken(false)
          window.dispatchEvent(new Event('successpadel:profile-synced'))
          return
        }
        setBroken(true)
      })
      return
    }

    if (recoveryRef.current === 'none' && isHostedAvatarUrl(current) && isOwnLineProfile) {
      recoveryRef.current = 'handshake'
      void refreshLineAvatarForCurrentUser().then((freshUrl) => {
        if (freshUrl && freshUrl !== current) {
          setSrc(freshUrl)
          setBroken(false)
          window.dispatchEvent(new Event('successpadel:profile-synced'))
          return
        }
        setBroken(true)
      })
      return
    }

    setBroken(true)
  }

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        onError={handleError}
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
