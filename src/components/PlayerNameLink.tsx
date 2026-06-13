import type { MouseEvent, ReactNode } from 'react'
import { useOpenPlayerProfile } from '../hooks/useOpenPlayerProfile'

type Props = {
  displayName: string
  profileId?: string | null
  padelPlayerId?: string | null
  competitionId?: string | null
  className?: string
  children?: ReactNode
  stopPropagation?: boolean
  disabled?: boolean
}

export function PlayerNameLink({
  displayName,
  profileId,
  padelPlayerId,
  competitionId,
  className = '',
  children,
  stopPropagation = true,
  disabled = false,
}: Props) {
  const { openProfile, opening } = useOpenPlayerProfile()

  const open = async (e: MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (disabled || opening) return
    await openProfile({ profileId, padelPlayerId, displayName, competitionId })
  }

  return (
    <button
      type="button"
      onClick={(e) => void open(e)}
      disabled={disabled || opening}
      className={`max-w-full truncate text-left underline-offset-2 hover:underline disabled:opacity-60 ${className}`}
    >
      {children ?? displayName}
    </button>
  )
}
