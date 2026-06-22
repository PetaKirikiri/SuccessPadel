import { useOpenPlayerProfile } from '../hooks/useOpenPlayerProfile'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { PlayerAvatar } from './PlayerAvatar'

type Props = {
  displayName: string
  avatarUrl?: string | null
  profileId?: string | null
  padelPlayerId?: string | null
  competitionId?: string | null
  className?: string
  imgClassName?: string
  disabled?: boolean
}

export function PlayerAvatarLink({
  displayName,
  avatarUrl,
  profileId,
  padelPlayerId,
  competitionId,
  className = '',
  imgClassName = 'h-7 w-7 shrink-0 rounded-full object-cover',
  disabled = false,
}: Props) {
  const { openProfile, opening } = useOpenPlayerProfile()
  const name = firstDisplayName(displayName || 'Player')
  const canOpen = Boolean(profileId || padelPlayerId || displayName.trim())

  const avatar = (
    <PlayerAvatar
      displayName={displayName}
      avatarUrl={avatarUrl}
      imgClassName={imgClassName}
      pixelated={avatarUrl?.includes('/pixel.png') ?? false}
    />
  )

  if (!canOpen || disabled) {
    return <span className={`shrink-0 ${className}`}>{avatar}</span>
  }

  return (
    <button
      type="button"
      disabled={opening}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void openProfile({ profileId, padelPlayerId, displayName, competitionId })
      }}
      className={`shrink-0 touch-manipulation disabled:opacity-60 ${className}`}
      aria-label={name}
    >
      {avatar}
    </button>
  )
}
