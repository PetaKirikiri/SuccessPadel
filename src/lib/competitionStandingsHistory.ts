import type { CompetitionPlayer } from '../hooks/useCompetitions'
import type { CompetitionRound, CourtMatch } from '../hooks/useCompetitionRun'
import type { CompetitionTeamConfig } from './competitionFormatPresets'
import { computeAmericanoStandings } from './competitionStandings'
import { computeDuoStandings } from './computeDuoStandings'
import { updateMovement } from './leaderboardMovement'

/** Reconstruct the selected game's standings from saved results, not browser history.
 * Saved participants take priority over a subsequently edited round lineup.
 */
export function competitionStandingsHistory(
  roster: CompetitionPlayer[], rounds: CompetitionRound[], matches: CourtMatch[],
  gameNumber: number, teams?: CompetitionTeamConfig[],
) {
  const historyRounds = rounds.filter(round => round.round_number <= gameNumber).map(round => ({
    ...round,
    competition_round_players: round.competition_round_players.map(player => ({ ...player })),
  }))
  for (const round of historyRounds) {
    for (const match of matches.filter(match => match.competition_round_id === round.id)) {
      const saved = match.match_players
      if (!saved.length || !saved.every(player => player.padel_player_id)) continue
      const original = round.competition_round_players.filter(player => player.court_id === match.court_id)
      const restored = saved.map(player => {
        const entrant = roster.find(entrant => entrant.padel_player_id === player.padel_player_id)
        const template = original.find(slot => slot.team === player.team)
        if (!entrant || !template) return null
        return { ...template, team: player.team, roster_entry_id: entrant.id,
          padel_player_id: entrant.padel_player_id ?? null, profile_id: entrant.profile_id }
      })
      // An unresolvable historic identity must not inherit another player's points.
      if (restored.some(player => player === null)) return null
      round.competition_round_players = [
        ...round.competition_round_players.filter(player => player.court_id !== match.court_id),
        ...restored.filter(player => player !== null),
      ]
    }
  }
  const calculate = (selected: CompetitionRound[]) => teams
    ? computeDuoStandings(roster, selected, matches, teams)
    : computeAmericanoStandings(roster, selected, matches)
  const entries = calculate(historyRounds)
  const before = calculate(historyRounds.filter(round => round.round_number < gameNumber))
  const baseline = updateMovement(null, before)
  const movement = updateMovement(baseline, entries)?.movement ?? {}
  // Before the first result there is no established position to move from.
  return { entries, movement: before.some(entry => entry.games > 0) ? movement : {} }
}
