import { useMemo } from 'react'
import type { GameRound } from '../lib/americanoSchedule'
import { breakMinutesFromConfig, gameSlotTimes } from '../lib/competitionLayout'
import { americanoScoringUnit } from '../lib/competitionPresets'
import { pivotScheduleByCourt } from '../lib/competitionCourtBoard'
import type { CourtRefsLookup } from '../lib/courtRefs'
import type { LiveCourtGamesScore } from '../lib/liveCourtScore'
import type { FriendlyCourtScoreSubmit } from '../lib/friendlyManualScore'
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
  courtRefs?: CourtRefsLookup
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  onSubmitFriendlyScores?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  onFriendlyScoresSaved?: () => void
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
  courtRefs,
  liveCourtScores,
  onSubmitFriendlyScores,
  onFriendlyScoresSaved,
}: Props) {
  const scoreUnit = americanoScoringUnit(session)
  const breakMinutes = breakMinutesFromConfig(session.scoring_config)

  const columns = useMemo(
    () => pivotScheduleByCourt(games, eventStartsAt, gameMinutes, breakMinutes),
    [breakMinutes, games, eventStartsAt, gameMinutes],
  )

  const roundTimesByGame = useMemo(() => {
    if (!eventStartsAt) return undefined
    const map = new Map<number, { startsAt: number; endsAt: number }>()
    for (const game of games) {
      const slot = gameSlotTimes(eventStartsAt, game.gameNumber, gameMinutes, breakMinutes)
      map.set(game.gameNumber, {
        startsAt: slot.startsAt.getTime(),
        endsAt: slot.endsAt.getTime(),
      })
    }
    return map
  }, [breakMinutes, eventStartsAt, gameMinutes, games])

  return (
    <CompetitionCourtBoard
      columns={columns}
      mode="preview"
      scoreUnit={scoreUnit}
      gameMinutes={gameMinutes}
      roundTimesByGame={roundTimesByGame}
      friendlySessionId={friendlySessionId}
      friendly={friendly}
      isAdmin={isAdmin}
      currentUserId={currentUserId}
      currentUserAvatarUrl={currentUserAvatarUrl}
      courtRefs={courtRefs}
      liveCourtScores={liveCourtScores}
      onSubmitFriendlyScores={onSubmitFriendlyScores}
      onSaved={onFriendlyScoresSaved}
    />
  )
}
