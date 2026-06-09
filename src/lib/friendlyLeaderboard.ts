import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
import type { Quadrant } from './gestureCapture'
import { listMatchSessions } from './matchSessionLog'
import { normalizeLeaderboardEntries } from './leaderboardEntries'
import type { MatchTeam } from './types'

function quadrantTeam(q: Quadrant): MatchTeam {
  return q === 'TL' || q === 'TR' ? 'a' : 'b'
}

export function buildFriendlyLeaderboardEntries(): LeaderboardEntry[] {
  const sessions = listMatchSessions().filter((s) => s.matchEndedAt && s.isFriendly)

  const totals = new Map<
    string,
    {
      profile_id: string
      member_profile_id: string | null
      display_name: string
      avatar_url: string | null
      wins: number
      losses: number
      games: number
    }
  >()

  for (const session of sessions) {
    if (!session.winner) continue
    for (const snap of session.playerStats ?? []) {
      const key = snap.playerId ?? snap.playerKey
      const team = quadrantTeam(snap.quadrant)
      const won = team === session.winner
      const cur = totals.get(key) ?? {
        profile_id: snap.playerId ?? key,
        member_profile_id: snap.playerId,
        display_name: snap.displayName,
        avatar_url: null,
        wins: 0,
        losses: 0,
        games: 0,
      }
      totals.set(key, {
        ...cur,
        display_name: snap.displayName || cur.display_name,
        wins: cur.wins + (won ? 1 : 0),
        losses: cur.losses + (won ? 0 : 1),
        games: cur.games + 1,
      })
    }
  }

  const rows = [...totals.values()]
    .sort((a, b) => b.wins - a.wins || b.games - a.games || a.display_name.localeCompare(b.display_name))
    .map((row) => ({
      profile_id: row.profile_id,
      member_profile_id: row.member_profile_id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      total_points: row.wins,
      games: row.games,
      wins: row.wins,
      losses: row.losses,
    }))

  return normalizeLeaderboardEntries(rows)
}
