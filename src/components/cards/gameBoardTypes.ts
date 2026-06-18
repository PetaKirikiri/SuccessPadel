import type { CourtPlayer } from '../../lib/americanoSchedule'

export type LiveCourt = {
  courtId: string
  courtName: string
  teamA: string[]
  teamB: string[]
  playerIds: string[]
  teamAPlayers?: CourtPlayer[]
  teamBPlayers?: CourtPlayer[]
}

export type ScoringGameCourt = {
  courtLabel: string
  teamA: string[]
  teamB: string[]
  teamAPlayers?: CourtPlayer[]
  teamBPlayers?: CourtPlayer[]
  timeLabel?: string
}
