import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
import type { CompetitionTeamConfig } from './competitionFormatPresets'
import { normalizeLeaderboardEntries } from './leaderboardEntries'
import { rosterDisplayName, type CompetitionPlayer } from '../hooks/useCompetitions'
import type { CompetitionRound, CourtMatch } from '../hooks/useCompetitionRun'
import { computeAmericanoStandings } from './competitionStandings'

function standingKey(sp: CompetitionPlayer | undefined): string | null {
  if (!sp) return null
  return sp.padel_player_id ?? sp.profile_id ?? sp.id
}

export function computeDuoStandings(
  roster: CompetitionPlayer[],
  rounds: CompetitionRound[],
  courtMatches: CourtMatch[],
  teams: CompetitionTeamConfig[],
): LeaderboardEntry[] {
  const solo = computeAmericanoStandings(roster, rounds, courtMatches)
  const byKey = new Map(solo.map((row) => [row.profile_id, row]))
  const rosterById = new Map(roster.map((r) => [r.id, r]))

  const entries: LeaderboardEntry[] = teams.map((team) => {
    const [idA, idB] = team.roster_ids
    const playerA = rosterById.get(idA)
    const playerB = rosterById.get(idB)
    const keyA = standingKey(playerA)
    const keyB = standingKey(playerB)
    const rowA = keyA ? byKey.get(keyA) : undefined
    const rowB = keyB ? byKey.get(keyB) : undefined

    const nameA = playerA ? rosterDisplayName(playerA) : 'Player'
    const nameB = playerB ? rosterDisplayName(playerB) : 'Player'
    const label = team.label.trim() || `${nameA} & ${nameB}`

    return {
      profile_id: `duo:${idA}:${idB}`,
      player_a_id: playerA?.profile_id ?? idA,
      player_b_id: playerB?.profile_id ?? idB,
      display_name: label,
      avatar_url: playerA?.profiles?.avatar_url ?? null,
      total_points: (rowA?.total_points ?? 0) + (rowB?.total_points ?? 0),
      games: Math.max(rowA?.games ?? 0, rowB?.games ?? 0),
      wins: (rowA?.wins ?? 0) + (rowB?.wins ?? 0),
      losses: (rowA?.losses ?? 0) + (rowB?.losses ?? 0),
      draws: (rowA?.draws ?? 0) + (rowB?.draws ?? 0),
    }
  })

  return normalizeLeaderboardEntries(
    entries.sort((a, b) => {
      return (
        b.total_points - a.total_points ||
        b.games - a.games ||
        a.display_name.localeCompare(b.display_name)
      )
    }),
  )
}
