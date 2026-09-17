import type { LeaderboardEntry } from '../../leaderboardTypes'
import { validateStandings, type CompetitionStandings, type DuoEntry } from '../contract.ts'

export function duoStandings(entries: LeaderboardEntry[], expectedTeams: number): CompetitionStandings & { format: 'duos' } {
  if (expectedTeams < 2 || entries.length !== expectedTeams || !validateStandings('duos', entries)) {
    return { format: 'duos', entries: [], error: 'Team standings unavailable: waiting for complete fixed-pair data.' }
  }
  return { format: 'duos', entries: entries.map(entry => ({ ...entry, format: 'duos' })) as DuoEntry[], error: null }
}
