import { useMemo } from 'react'
import type { GameRound } from '../lib/americanoSchedule'
import { americanoScoringUnit } from '../lib/competitionPresets'
import { pivotScheduleByCourt } from '../lib/competitionCourtBoard'
import type { GameSession } from '../lib/types'
import { CompetitionCourtBoard } from './CompetitionCourtBoard'

type Props = {
  session: GameSession
  games: GameRound[]
  eventStartsAt?: string
  gameMinutes: number
}

export function CompetitionLayoutPreview({
  session,
  games,
  eventStartsAt,
  gameMinutes,
}: Props) {
  const scoreUnit = americanoScoringUnit(session)

  const columns = useMemo(
    () => pivotScheduleByCourt(games, eventStartsAt, gameMinutes),
    [games, eventStartsAt, gameMinutes],
  )

  return <CompetitionCourtBoard columns={columns} mode="preview" scoreUnit={scoreUnit} />
}
