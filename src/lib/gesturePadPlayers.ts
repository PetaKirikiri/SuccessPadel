import type { CourtPlayer } from './americanoSchedule'
import type { GameRow } from './competitionCourtBoard'
import type { Quadrant } from './gestureCapture'

export type QuadrantPlayers = Partial<Record<Quadrant, CourtPlayer>>

type LiveCourtLike = {
  courtId?: string
  playerIds?: string[]
  teamA: string[]
  teamB: string[]
  teamAPlayers?: CourtPlayer[]
  teamBPlayers?: CourtPlayer[]
}

export function quadrantPlayersForCourt(
  teamA: string[],
  teamB: string[],
  teamAPlayers?: CourtPlayer[],
  teamBPlayers?: CourtPlayer[],
): QuadrantPlayers {
  return {
    TL: teamAPlayers?.[0] ?? { id: null, name: teamA[0] ?? '', avatarUrl: null },
    TR: teamAPlayers?.[1] ?? { id: null, name: teamA[1] ?? '', avatarUrl: null },
    BL: teamBPlayers?.[0] ?? { id: null, name: teamB[0] ?? '', avatarUrl: null },
    BR: teamBPlayers?.[1] ?? { id: null, name: teamB[1] ?? '', avatarUrl: null },
  }
}

export function quadrantPlayersForGesturePad(
  courtsForGame: LiveCourtLike[],
  gameRow: GameRow | undefined,
  courtId?: string | null,
): QuadrantPlayers {
  const live = courtId
    ? courtsForGame.find((c) => c.courtId === courtId)
    : courtsForGame[0]
  if (live) {
    return quadrantPlayersForCourt(live.teamA, live.teamB, live.teamAPlayers, live.teamBPlayers)
  }

  const scheduled = gameRow?.courts[0]
  if (scheduled) {
    return quadrantPlayersForCourt(
      [...scheduled.teamA],
      [...scheduled.teamB],
      scheduled.teamAPlayers,
      scheduled.teamBPlayers,
    )
  }

  return {}
}
