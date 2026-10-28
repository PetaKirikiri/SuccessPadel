import type { CourtPlayer } from '../../lib/americanoSchedule'
import type { RainRound } from './rainSchedule'

export type SavedRainDraw = {
  version: number
  competitionId: string
  date: string
  timezone: string
  courtLabels: string[]
  courtIds: string[]
  players: { name: string; rosterId: string; id?: string | null; avatarUrl?: string | null }[]
  rounds: { startsAt: string; endsAt: string; courts: string[][][]; resting: string[] }[]
  settings?: {
    startTime: string; cutoff: string; gameMinutes: number; changeoverMinutes: number
    roundCount: number; playersStayingPerCourt: number; keepSameCourt: boolean
    maxConsecutiveGames: number; finalFullSwap: boolean
  }
}
export type RainDrawRecord = { session_id: string; fingerprint: string; active: boolean; draw: SavedRainDraw }

/** Read the assigned draw; never regenerate it from a mutable roster or standings. */
export function unpackRainDraw(record: RainDrawRecord): RainRound[] {
  const draw = record.draw
  if (draw.competitionId !== record.session_id || !/^[a-f0-9]{64}$/.test(record.fingerprint)
    || draw.timezone !== 'Asia/Bangkok' || !/^\d{4}-\d{2}-\d{2}$/.test(draw.date)
    || draw.courtIds.join(',') !== 'rain-court-1,rain-court-2'
    || draw.courtLabels.length !== 2 || draw.rounds.length < 1 || draw.rounds.length > 20
    || new Set(draw.players.map(p => p.rosterId)).size !== draw.players.length
    || new Set(draw.players.map(p => p.name)).size !== draw.players.length) {
    throw new Error('The saved rain draw is invalid. No replacement draw was generated.')
  }
  const players = new Map<string, CourtPlayer>(draw.players.map(p => [p.name, { ...p, id: p.id ?? null, avatarUrl: p.avatarUrl ?? null }]))
  const resolve = (name: string) => {
    const player = players.get(name)
    if (!player?.rosterId) throw new Error('The saved rain draw contains an unknown player.')
    return player
  }
  const pair = (names: string[]): [CourtPlayer, CourtPlayer] => {
    if (names.length !== 2) throw new Error('The saved rain draw has an incomplete pair.')
    return [resolve(names[0]!), resolve(names[1]!)]
  }
  return draw.rounds.map((round, index) => {
    const names = [...round.courts.flat(2), ...round.resting]
    if (round.courts.length !== 2 || round.courts.some(c => c.length !== 2)
      || names.length !== players.size || new Set(names).size !== players.size) throw new Error('The saved round has missing or duplicated players.')
    const timeLabel = `${round.startsAt}–${round.endsAt}`
    return {
      startsAt: round.startsAt, endsAt: round.endsAt, resting: round.resting.map(resolve),
      game: { gameNumber: index + 1, timeLabel, courts: round.courts.map((teams, c) => ({
        gameNumber: index + 1, timeLabel, courtLabel: draw.courtLabels[c]!,
        teamA: teams[0]! as [string, string], teamB: teams[1]! as [string, string],
        teamAPlayers: pair(teams[0]!), teamBPlayers: pair(teams[1]!),
      })) },
    }
  })
}

export function rainReturnTime(rounds: RainRound[], selected: number, rosterId: string): string | null {
  return rounds.slice(selected + 1).find(r => r.game.courts.some(c =>
    [...c.teamAPlayers!, ...c.teamBPlayers!].some(p => p.rosterId === rosterId)))?.startsAt ?? null
}
