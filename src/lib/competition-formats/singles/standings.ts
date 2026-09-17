import type { LeaderboardEntry } from '../../leaderboardTypes'
import { validateStandings, type CompetitionStandings } from '../contract.ts'

export function singlesStandings(entries: LeaderboardEntry[]): CompetitionStandings & { format: 'singles' } {
  if (!validateStandings('singles', entries)) {
    return { format: 'singles', entries: [], error: 'Player standings unavailable: unexpected team data.' }
  }
  return { format: 'singles', entries: entries.map(entry => ({ ...entry, format: 'singles' })), error: null }
}
