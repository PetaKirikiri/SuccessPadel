import { useMemo } from 'react'
import type { GameRound } from '../lib/americanoSchedule'
import { breakMinutesFromConfig, competitionRoundTimesByGame, gameSlotOptsFromSchedule, gameSlotTimes, eventDurationMinutes } from '../lib/competitionLayout'
import { americanoScoringUnit } from '../lib/competitionPresets'
import { pivotScheduleByCourt } from '../lib/competitionCourtBoard'
import type { LiveCourtGamesScore, LiveCourtPointFeed } from '../lib/liveCourtScore'
import type { FriendlyCourtScoreSubmit } from '../lib/friendlyManualScore'
import type { GameSession } from '../lib/types'
import { GameBoard } from './GameBoard'

type Props = {
  session: Pick<GameSession, 'partnership_mode' | 'rules' | 'scoring_config'> &
    Partial<Pick<GameSession, 'starts_at' | 'ends_at' | 'target_players' | 'max_players'>>
  games: GameRound[]
  eventStartsAt?: string
  gameMinutes: number
  friendlySessionId?: string
  friendly?: boolean
  isAdmin?: boolean
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  liveCourtFeeds?: Map<string, LiveCourtPointFeed>
  onSubmitFriendlyScores?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  onFriendlyScoresSaved?: () => void
  gameCarousel?: boolean
  currentUserDisplayName?: string | null
  onBack?: () => void
  viewAlongUrl?: string | null
  scoreSubmitEnabled?: boolean
}

export function GameBoardPreview({
  session,
  games,
  eventStartsAt,
  gameMinutes,
  friendlySessionId,
  friendly = false,
  isAdmin = false,
  currentUserId,
  currentUserAvatarUrl,
  liveCourtScores,
  liveCourtFeeds,
  onSubmitFriendlyScores,
  onFriendlyScoresSaved,
  gameCarousel = false,
  currentUserDisplayName,
  onBack,
  viewAlongUrl = null,
  scoreSubmitEnabled = true,
}: Props) {
  const scoreUnit = americanoScoringUnit(session)
  const breakMinutes = breakMinutesFromConfig(session.scoring_config)

  const columns = useMemo(
    () => pivotScheduleByCourt(games, eventStartsAt, gameMinutes, breakMinutes),
    [breakMinutes, games, eventStartsAt, gameMinutes],
  )

  const roundTimesByGame = useMemo(() => {
    if (session.starts_at && session.ends_at) {
      return competitionRoundTimesByGame(
        {
          starts_at: session.starts_at,
          ends_at: session.ends_at,
          scoring_config: session.scoring_config,
          target_players: session.target_players ?? null,
          max_players: session.max_players ?? null,
        },
        games.length,
      )
    }
    if (!eventStartsAt) return undefined
    const map = new Map<number, { startsAt: number; endsAt: number }>()
    const slotOpts =
      eventStartsAt && session.ends_at
        ? gameSlotOptsFromSchedule({
            eventMinutes: eventDurationMinutes(eventStartsAt, session.ends_at),
            totalGames: games.length,
          })
        : undefined
    for (const game of games) {
      const slot = gameSlotTimes(eventStartsAt, game.gameNumber, gameMinutes, breakMinutes, slotOpts)
      map.set(game.gameNumber, {
        startsAt: slot.startsAt.getTime(),
        endsAt: slot.endsAt.getTime(),
      })
    }
    return map
  }, [breakMinutes, eventStartsAt, gameMinutes, games, session])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <GameBoard
      columns={columns}
      mode="preview"
      scoreUnit={scoreUnit}
      gameMinutes={gameMinutes}
      roundTimesByGame={roundTimesByGame}
      friendlySessionId={friendlySessionId}
      friendly={friendly}
      isAdmin={isAdmin}
      currentUserId={currentUserId}
      currentUserDisplayName={currentUserDisplayName}
      currentUserAvatarUrl={currentUserAvatarUrl}
      liveCourtScores={liveCourtScores}
      liveCourtFeeds={liveCourtFeeds}
      onSubmitFriendlyScores={onSubmitFriendlyScores}
      onSaved={onFriendlyScoresSaved}
      tvCarousel={gameCarousel}
      viewAlongUrl={viewAlongUrl}
      scoreSubmitEnabled={scoreSubmitEnabled}
      onTvBack={onBack}
    />
    </div>
  )
}
