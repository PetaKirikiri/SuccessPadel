import type { CourtPlayer } from './americanoSchedule'
import type { CourtColumn } from './competitionCourtBoard'
import {
  formatTeamLabelForDisplay,
  type CompetitionTeamConfig,
} from './competitionFormatPresets'
import { rosterDisplayName, type CompetitionPlayer } from '../hooks/useCompetitions'
import type { LeaderboardEntry } from './leaderboardTypes'
import { normalizeLeaderboardEntries } from './leaderboardEntries'

export type ManualCourtScore = {
  gameNumber: number
  courtId: string
  teamA: number
  teamB: number
}

export function manualCourtScoreKey(gameNumber: number, courtId: string): string {
  return `${gameNumber}:${courtId}`
}

function rosterKey(ids: string[]): string {
  return [...ids].sort().join(':')
}

function playerRosterId(player: CourtPlayer): string | null {
  return player.rosterId ?? player.id ?? null
}

type CourtSides = { teamA: CourtPlayer[]; teamB: CourtPlayer[] }

function courtSidesByScoreKey(
  columns: CourtColumn[],
  courtIdByLabel: Map<string, string>,
): Map<string, CourtSides> {
  const map = new Map<string, CourtSides>()
  for (const col of columns) {
    const courtId = courtIdByLabel.get(col.courtLabel)
    if (!courtId) continue
    for (const cell of col.cells) {
      map.set(manualCourtScoreKey(cell.gameNumber, courtId), {
        teamA: cell.teamAPlayers ? [...cell.teamAPlayers] : [],
        teamB: cell.teamBPlayers ? [...cell.teamBPlayers] : [],
      })
    }
  }
  return map
}

function applyPlayerSideScores(
  totals: Map<
    string,
    {
      points: number
      games: number
      wins: number
      losses: number
      draws: number
      display_name: string
      member_profile_id: string | null
      avatar_url: string | null
    }
  >,
  players: CourtPlayer[],
  teamScore: number,
  oppScore: number,
  roster: CompetitionPlayer[],
) {
  const rosterById = new Map(roster.map((row) => [row.id, row]))
  for (const player of players) {
    const id = playerRosterId(player)
    if (!id) continue
    const row = rosterById.get(id)
    const cur = totals.get(id) ?? {
      points: 0,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      display_name: player.name || (row ? rosterDisplayName(row) : id),
      member_profile_id: row?.profile_id ?? player.id,
      avatar_url: player.avatarUrl ?? row?.profiles?.avatar_url ?? null,
    }
    totals.set(id, {
      ...cur,
      points: cur.points + teamScore,
      games: cur.games + 1,
      wins: cur.wins + (teamScore > oppScore ? 1 : 0),
      losses: cur.losses + (teamScore < oppScore ? 1 : 0),
      draws: cur.draws + (teamScore === oppScore ? 1 : 0),
    })
  }
}

/** Standings from court-card manual games when DB rounds are not ready yet. */
export function computeManualCourtStandings(params: {
  scores: ReadonlyMap<string, ManualCourtScore>
  columns: CourtColumn[]
  courtIdByLabel: Map<string, string>
  isDuo: boolean
  teams: CompetitionTeamConfig[]
  roster: CompetitionPlayer[]
}): LeaderboardEntry[] {
  const { scores, columns, courtIdByLabel, isDuo, teams, roster } = params
  if (scores.size === 0 || columns.length === 0) return []

  const sidesByKey = courtSidesByScoreKey(columns, courtIdByLabel)

  if (isDuo && teams.length >= 2) {
    const rosterById = new Map(roster.map((row) => [row.id, row]))
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
      const label =
        customLabel && !/^Team\s+\d+$/i.test(customLabel)
          ? customLabel
          : `${nameA} & ${nameB}`
      teamByRosterKey.set(rosterKey(team.roster_ids), entries.length)
      entries.push({
        profile_id: `duo:${idA}:${idB}`,
        player_a_id: playerA.profile_id ?? idA,
        player_b_id: playerB.profile_id ?? idB,
        player_a_name: nameA,
        player_b_name: nameB,
        player_a_avatar_url: playerA.profiles?.avatar_url ?? null,
        player_b_avatar_url: playerB.profiles?.avatar_url ?? null,
        display_name: formatTeamLabelForDisplay(label) || label,
        avatar_url: null,
        total_points: 0,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      })
    }

    for (const score of scores.values()) {
      const sides = sidesByKey.get(manualCourtScoreKey(score.gameNumber, score.courtId))
      if (!sides) continue
      const idsA = sides.teamA.map((p) => playerRosterId(p)).filter(Boolean) as string[]
      const idsB = sides.teamB.map((p) => playerRosterId(p)).filter(Boolean) as string[]
      for (const side of ['a', 'b'] as const) {
        const ids = side === 'a' ? idsA : idsB
        const index = teamByRosterKey.get(rosterKey(ids))
        if (index == null) continue
        const teamScore = side === 'a' ? score.teamA : score.teamB
        const oppScore = side === 'a' ? score.teamB : score.teamA
        const entry = entries[index]!
        entry.total_points += teamScore
        entry.games = (entry.games ?? 0) + 1
        entry.wins = (entry.wins ?? 0) + (teamScore > oppScore ? 1 : 0)
        entry.losses = (entry.losses ?? 0) + (teamScore < oppScore ? 1 : 0)
        entry.draws = (entry.draws ?? 0) + (teamScore === oppScore ? 1 : 0)
      }
    }

    return normalizeLeaderboardEntries(
      entries.sort(
        (a, b) =>
          b.total_points - a.total_points ||
          b.games - a.games ||
          a.display_name.localeCompare(b.display_name),
      ),
    )
  }

  const totals = new Map<
    string,
    {
      points: number
      games: number
      wins: number
      losses: number
      draws: number
      display_name: string
      member_profile_id: string | null
      avatar_url: string | null
    }
  >(
    roster.map((row) => [
      row.id,
      {
        points: 0,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        display_name: rosterDisplayName(row),
        member_profile_id: row.profile_id,
        avatar_url: row.profiles?.avatar_url ?? null,
      },
    ]),
  )

  for (const score of scores.values()) {
    const sides = sidesByKey.get(manualCourtScoreKey(score.gameNumber, score.courtId))
    if (!sides) continue
    applyPlayerSideScores(totals, sides.teamA, score.teamA, score.teamB, roster)
    applyPlayerSideScores(totals, sides.teamB, score.teamB, score.teamA, roster)
  }

  return normalizeLeaderboardEntries(
    [...totals.entries()]
      .map(([profile_id, row]) => ({
        profile_id,
        member_profile_id: row.member_profile_id,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        total_points: row.points,
        games: row.games,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
      }))
      .sort(
        (a, b) =>
          b.total_points - a.total_points ||
          b.games - a.games ||
          a.display_name.localeCompare(b.display_name),
      ),
  )
}
