import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
import { normalizeLeaderboardEntries } from './leaderboardEntries'
import { rosterDisplayName, type CompetitionPlayer } from '../hooks/useCompetitions'
import type { CompetitionRound, CourtMatch } from '../hooks/useCompetitionRun'

export function computeAmericanoStandings(
  roster: CompetitionPlayer[],
  rounds: CompetitionRound[],
  courtMatches: CourtMatch[],
): LeaderboardEntry[] {
  const totals = new Map<string, { points: number; games: number; wins: number; losses: number }>()

  for (const match of courtMatches) {
    const parts = match.score_summary?.split('-').map((s) => Number(s.trim()))
    if (!parts || parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) continue

    const round = rounds.find((r) => r.id === match.competition_round_id)
    if (!round) continue

    const [scoreA, scoreB] = parts
    for (const p of round.competition_round_players ?? []) {
      if (p.court_id !== match.court_id) continue
      const key = p.padel_player_id ?? p.profile_id ?? p.roster_entry_id
      const teamScore = p.team === 'a' ? scoreA! : scoreB!
      const oppScore = p.team === 'a' ? scoreB! : scoreA!
      const cur = totals.get(key) ?? { points: 0, games: 0, wins: 0, losses: 0 }
      totals.set(key, {
        points: cur.points + teamScore,
        games: cur.games + 1,
        wins: cur.wins + (teamScore > oppScore ? 1 : 0),
        losses: cur.losses + (teamScore < oppScore ? 1 : 0),
      })
    }
  }

  return normalizeLeaderboardEntries(
    roster
      .map((sp) => {
        const key = sp.padel_player_id ?? sp.profile_id ?? sp.id
        const scored = totals.get(key)
        return {
          profile_id: key,
          padel_player_id: sp.padel_player_id,
          member_profile_id: sp.profile_id,
          is_guest: !sp.profile_id,
          display_name: rosterDisplayName(sp),
          avatar_url: sp.profiles?.avatar_url ?? null,
          total_points: scored?.points ?? 0,
          games: scored?.games ?? 0,
          wins: scored?.wins ?? 0,
          losses: scored?.losses ?? 0,
        }
      })
      .sort((a, b) => {
        const spA = roster.find(
          (sp) => (sp.padel_player_id ?? sp.profile_id ?? sp.id) === a.profile_id,
        )
        const spB = roster.find(
          (sp) => (sp.padel_player_id ?? sp.profile_id ?? sp.id) === b.profile_id,
        )
        const rankA = spA?.rank_order ?? 999
        const rankB = spB?.rank_order ?? 999
        return (
          b.total_points - a.total_points ||
          b.games - a.games ||
          rankA - rankB ||
          a.display_name.localeCompare(b.display_name)
        )
      }),
  )
}
