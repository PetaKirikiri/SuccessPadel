import savedDraw from './rain-draw-2026-10-07.json'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import type { RainRound } from './rainSchedule'

export const RAIN_COMPETITION_ID = savedDraw.competitionId
export const RAIN_DRAW_FINGERPRINT = 'acdca2fd5eeca552f1da8558689f990f91bca9ae22e60ea85215ab1cef5dcdc0'
export const RAIN_COURT_IDS = new Map(savedDraw.courtLabels.map((label, index) => [label, savedDraw.courtIds[index]!]))

/** Authoritative, already-assigned draw. Never regenerate from attendance or ranking. */
export function loadFrozenRainDraw(): RainRound[] {
  const players = new Map<string, CourtPlayer>(savedDraw.players.map(player => [player.name, {
    ...player, id: player.id ?? null, avatarUrl: player.avatarUrl ?? null,
  }]))
  const resolve = (name: string): CourtPlayer => {
    const player = players.get(name)
    if (!player) throw new Error(`Saved rain draw has an unknown player: ${name}`)
    return { ...player }
  }
  const pair = (names: string[]): [CourtPlayer, CourtPlayer] => {
    if (names.length !== 2) throw new Error('Saved rain draw has an incomplete team.')
    return [resolve(names[0]!), resolve(names[1]!)]
  }
  return savedDraw.rounds.map((round, index) => {
    const gameNumber = index + 1
    const timeLabel = `${round.startsAt}–${round.endsAt}`
    return {
      startsAt: round.startsAt, endsAt: round.endsAt,
      resting: round.resting.map(resolve),
      game: { gameNumber, timeLabel, courts: round.courts.map((teams, courtIndex) => {
        const teamAPlayers = pair(teams[0]!)
        const teamBPlayers = pair(teams[1]!)
        return {
          gameNumber, timeLabel, courtLabel: savedDraw.courtLabels[courtIndex]!,
          teamA: [teamAPlayers[0].name, teamAPlayers[1].name],
          teamB: [teamBPlayers[0].name, teamBPlayers[1].name],
          teamAPlayers, teamBPlayers,
        }
      }) },
    }
  })
}
