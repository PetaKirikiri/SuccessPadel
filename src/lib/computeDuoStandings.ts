import type { LeaderboardEntry } from './leaderboardTypes'
import type { CompetitionTeamConfig } from './competitionFormatPresets'
import { normalizeLeaderboardEntries } from './leaderboardEntries'
import { rosterDisplayName, type CompetitionPlayer } from '../hooks/useCompetitions'
import type { CompetitionRound, CourtMatch } from '../hooks/useCompetitionRun'

function rosterKey(ids: string[]): string {
  return [...ids].sort().join(':')
}

function parsedScore(scoreSummary: string | null | undefined): [number, number] | null {
  const parts = scoreSummary?.split('-').map((s) => Number(s.trim()))
  if (!parts || parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null
  return [parts[0]!, parts[1]!]
}

function isDefaultTeamLabel(label: string): boolean {
  return /^Team\s+\d+$/i.test(label.trim())
}

export function computeDuoStandings(
  roster: CompetitionPlayer[],
  rounds: CompetitionRound[],
  courtMatches: CourtMatch[],
  teams: CompetitionTeamConfig[],
): LeaderboardEntry[] {
  const rosterById = new Map(roster.map((r) => [r.id, r]))
  const teamByRosterKey = new Map<string, number>()

  const entries: LeaderboardEntry[] = []
  for (const team of teams) {
    const [idA, idB] = team.roster_ids
    const playerA = rosterById.get(idA)
    const playerB = rosterById.get(idB)
    if (!playerA || !playerB) continue

    const nameA = rosterDisplayName(playerA)
    const nameB = rosterDisplayName(playerB)
    const customLabel = team.label.trim()
    const label = customLabel && !isDefaultTeamLabel(customLabel) ? customLabel : `${nameA} & ${nameB}`
    const entryIndex = entries.length
    teamByRosterKey.set(rosterKey(team.roster_ids), entryIndex)

    entries.push({
      profile_id: `duo:${idA}:${idB}`,
      player_a_id: playerA?.profile_id ?? idA,
      player_b_id: playerB?.profile_id ?? idB,
      player_a_name: nameA,
      player_b_name: nameB,
      player_a_avatar_url: playerA?.profiles?.avatar_url ?? null,
      player_b_avatar_url: playerB?.profiles?.avatar_url ?? null,
      display_name: label,
      avatar_url: null,
      total_points: 0,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    })
  }

  const roundsById = new Map(rounds.map((round) => [round.id, round]))

  for (const match of courtMatches) {
    const score = parsedScore(match.score_summary)
    if (!score) continue
    const round = roundsById.get(match.competition_round_id)
    if (!round) continue

    const courtPlayers = (round.competition_round_players ?? []).filter(
      (player) => player.court_id === match.court_id,
    )
    const teamRosterIds = {
      a: courtPlayers
        .filter((player) => player.team === 'a')
        .map((player) => player.roster_entry_id),
      b: courtPlayers
        .filter((player) => player.team === 'b')
        .map((player) => player.roster_entry_id),
    }

    for (const side of ['a', 'b'] as const) {
      const index = teamByRosterKey.get(rosterKey(teamRosterIds[side]))
      if (index == null) continue
      const teamScore = side === 'a' ? score[0] : score[1]
      const oppScore = side === 'a' ? score[1] : score[0]
      const entry = entries[index]!
      entry.total_points += teamScore
      entry.games += 1
      entry.wins = (entry.wins ?? 0) + (teamScore > oppScore ? 1 : 0)
      entry.losses = (entry.losses ?? 0) + (teamScore < oppScore ? 1 : 0)
      entry.draws = (entry.draws ?? 0) + (teamScore === oppScore ? 1 : 0)
    }
  }

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
