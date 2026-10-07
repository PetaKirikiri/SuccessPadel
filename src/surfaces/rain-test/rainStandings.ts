import type { LeaderboardEntry } from '../../lib/leaderboardTypes'
import type { RainRound } from './rainSchedule'
import { rainScoreKey, type RainScores } from './rainScores'

/** Recalculate from the score ledger, so editing a result cannot double-count it. */
export function rainStandings(rounds: RainRound[], scores: RainScores): LeaderboardEntry[] {
  const entries = new Map<string, LeaderboardEntry>()
  for (const round of rounds) {
    for (const player of [...round.resting, ...round.game.courts.flatMap(c => [...c.teamAPlayers!, ...c.teamBPlayers!])]) {
      if (!entries.has(player.rosterId!)) entries.set(player.rosterId!, {
        profile_id: player.rosterId!, roster_entry_id: player.rosterId,
        member_profile_id: player.id, display_name: player.name, avatar_url: player.avatarUrl,
        total_points: 0, games: 0, wins: 0, losses: 0, draws: 0,
      })
    }
    round.game.courts.forEach((court, index) => {
      const score = scores[rainScoreKey(round.game.gameNumber, `rain-court-${index + 1}`)]
      if (!score) return
      ;[court.teamAPlayers!, court.teamBPlayers!].forEach((team, side) => {
        const own = side === 0 ? score.teamAPoints : score.teamBPoints
        const against = side === 0 ? score.teamBPoints : score.teamAPoints
        for (const player of team) {
          const entry = entries.get(player.rosterId!)!
          entry.total_points += own
          entry.games++
          if (own > against) entry.wins!++
          else if (own < against) entry.losses!++
          else entry.draws!++
        }
      })
    })
  }
  return [...entries.values()].sort((a, b) => b.total_points - a.total_points || a.display_name.localeCompare(b.display_name))
}
