import { useCallback } from 'react'
import { claimPadelPlayer } from '../lib/claimPadelPlayer'
import { hasLinePlayerLink, startLinePlayerLink } from '../lib/line/playerLink'
import { useAuth } from '../providers/AuthProvider'

type Options = {
  competitionId?: string | null
  onClaimed?: () => void
}

export function useGuestPlayerClaim({ competitionId = null, onClaimed }: Options = {}) {
  const { user } = useAuth()
  const lineEnabled = hasLinePlayerLink()

  const signInToClaim = useCallback(
    async (padelPlayerId: string) => {
      if (lineEnabled) {
        const err = await startLinePlayerLink(competitionId, padelPlayerId)
        if (err) throw new Error(err)
        return
      }
      window.location.assign('/login')
    },
    [competitionId, lineEnabled],
  )

  const claimNow = useCallback(
    async (padelPlayerId: string) => {
      const err = await claimPadelPlayer(padelPlayerId)
      if (err) throw new Error(err)
      onClaimed?.()
    },
    [onClaimed],
  )

  return {
    userId: user?.id ?? null,
    lineEnabled,
    signInToClaim,
    claimNow,
  }
}
