import type { LeaderboardEntry } from '../leaderboardTypes'

export type CompetitionFormat = 'singles' | 'duos'
export type SinglesEntry = LeaderboardEntry & { format: 'singles' }
export type DuoEntry = LeaderboardEntry & {
  format: 'duos'
  player_a_id: string
  player_b_id: string
  player_a_name: string
  player_b_name: string
}
export type CompetitionStandings =
  | { format: 'singles'; entries: SinglesEntry[]; error: string | null }
  | { format: 'duos'; entries: DuoEntry[]; error: string | null }

export function validDuoEntry(entry: LeaderboardEntry): boolean {
  return entry.profile_id.startsWith('duo:') &&
    Boolean(entry.player_a_id && entry.player_b_id && entry.player_a_id !== entry.player_b_id &&
      entry.player_a_name?.trim() && entry.player_b_name?.trim()) &&
    Number.isFinite(entry.total_points) && entry.total_points >= 0
}

/** Fail closed: an incomplete/mixed response must never change the format. */
export function validateStandings(format: CompetitionFormat, entries: LeaderboardEntry[]): boolean {
  if (new Set(entries.map(entry => entry.profile_id)).size !== entries.length) return false
  return entries.every(entry => format === 'duos' ? validDuoEntry(entry) :
    !entry.profile_id.startsWith('duo:') && !entry.player_a_id && !entry.player_b_id &&
    Number.isFinite(entry.total_points) && entry.total_points >= 0)
}
