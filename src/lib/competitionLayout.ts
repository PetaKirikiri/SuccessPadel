import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'

export const PLAYERS_PER_COURT = 4
export const COMPETITION_BREAK_MINUTES = 1
export { RANKED_AMERICANO_GAMES, RANKED_GAME_MINUTES } from './rankedSchedule'

export function courtsNeeded(playerCount: number): number {
  return Math.floor(playerCount / PLAYERS_PER_COURT)
}

export function isValidCourtLayout(playerCount: number): boolean {
  return playerCount >= PLAYERS_PER_COURT && playerCount % PLAYERS_PER_COURT === 0
}

/** Americano: each player partners with every other player once → n − 1 games. */
export function americanoRoundsForFullRotation(playerCount: number): number {
  if (playerCount < PLAYERS_PER_COURT) return 0
  return playerCount - 1
}

export function eventDurationMinutes(startsAt: string, endsAt: string): number {
  return Math.max(0, (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000)
}

/** floor(eventMinutes / totalGames − breakMinutes) — e.g. 120 min ÷ 11 games − 1 = 9 min play. */
export function gameDurationForEvent(
  eventMinutes: number,
  totalGames: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
): number {
  if (totalGames <= 0 || eventMinutes <= 0) return 0
  return Math.max(1, Math.floor(eventMinutes / totalGames - breakMinutes))
}

export function gameSlotTimes(
  eventStartsAt: string,
  gameNumber: number,
  gameMinutes: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
): { startsAt: Date; endsAt: Date } {
  const offsetMin = (gameNumber - 1) * (gameMinutes + breakMinutes)
  const startsAt = new Date(new Date(eventStartsAt).getTime() + offsetMin * 60000)
  const endsAt = new Date(startsAt.getTime() + gameMinutes * 60000)
  return { startsAt, endsAt }
}

export function eventScheduleSummary(
  startsAt: string,
  endsAt: string,
  totalGames: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
): string {
  const eventMinutes = Math.round(eventDurationMinutes(startsAt, endsAt))
  const gameMinutes = gameDurationForEvent(eventMinutes, totalGames, breakMinutes)
  return `${totalGames} games · ${gameMinutes} min each + ${breakMinutes} min break (${eventMinutes} min event)`
}

export type CourtLayoutSlot = {
  courtIndex: number
  courtLabel: string
  players: string[]
}

export function buildCourtLayout(
  roster: CompetitionPlayer[],
  courtNames: string[],
): CourtLayoutSlot[] {
  const needed = courtsNeeded(roster.length)
  const names = roster.map(rosterDisplayName)
  const slots: CourtLayoutSlot[] = []

  for (let i = 0; i < needed; i += 1) {
    const start = i * PLAYERS_PER_COURT
    slots.push({
      courtIndex: i + 1,
      courtLabel: courtNames[i] ?? `Court ${i + 1}`,
      players: names.slice(start, start + PLAYERS_PER_COURT),
    })
  }

  return slots
}
