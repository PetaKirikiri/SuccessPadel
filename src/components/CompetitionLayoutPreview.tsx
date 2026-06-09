import { useMemo } from 'react'
import type { GameRound } from '../lib/americanoSchedule'
import { americanoScoringUnit } from '../lib/competitionPresets'
import { pivotScheduleByCourt } from '../lib/competitionCourtBoard'
import type { GameSession } from '../lib/types'
import { CompetitionCourtBoard } from './CompetitionCourtBoard'

type Props = {
  session: Pick<GameSession, 'partnership_mode' | 'rules' | 'scoring_config'>
  games: GameRound[]
  eventStartsAt?: string
  gameMinutes: number
  friendlySessionId?: string
  friendly?: boolean
  isAdmin?: boolean
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
}

export function CompetitionLayoutPreview({
  session,
  games,
  eventStartsAt,
  gameMinutes,
  friendlySessionId,
  friendly = false,
  isAdmin = false,
  currentUserId,
  currentUserAvatarUrl,
}: Props) {
  const scoreUnit = americanoScoringUnit(session)

  const columns = useMemo(
    () => pivotScheduleByCourt(games, eventStartsAt, gameMinutes),
    [games, eventStartsAt, gameMinutes],
  )

  return (
    <CompetitionCourtBoard
      columns={columns}
      mode="preview"
      scoreUnit={scoreUnit}
      friendlySessionId={friendlySessionId}
      friendly={friendly}
      isAdmin={isAdmin}
      currentUserId={currentUserId}
      currentUserAvatarUrl={currentUserAvatarUrl}
    />
  )
}
