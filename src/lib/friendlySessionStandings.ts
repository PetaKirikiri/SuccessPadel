import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
import type { CourtPlayer } from './americanoSchedule'
import type { AmericanoScoringUnit } from './competitionPresets'
import { quadrantTeam } from './gestureScoring'
import type { GameLogRosterSlot } from './gameLogSerialize'
import { normalizeLeaderboardEntries } from './leaderboardEntries'
import type { MatchGestureLog } from './matchLogServer'

type PlayerTotals = {
  profile_id: string
  member_profile_id: string | null
  display_name: string
  avatar_url: string | null
  points: number
  games: number
  wins: number
  losses: number
}

function rosterPlayerKey(slot: GameLogRosterSlot): string | null {
  if (slot.playerId) return slot.playerId
  if (slot.name.trim()) return slot.name.trim()
  return null
}

function teamScores(
  log: MatchGestureLog,
  scoreUnit: AmericanoScoringUnit,
): [number, number] | null {
  const score = log.finalScore
  if (!score) return null
  if (scoreUnit === 'points') return [score.pointsA ?? 0, score.pointsB ?? 0]
  return [score.gamesA ?? 0, score.gamesB ?? 0]
}

function latestLogsByCourt(logs: MatchGestureLog[]): MatchGestureLog[] {
  const map = new Map<string, MatchGestureLog>()
  for (const log of logs) {
    const stamp = log.updatedAt ?? log.matchEndedAt ?? log.matchStartedAt
    const existing = map.get(log.courtSetupKey)
    if (!existing) {
      map.set(log.courtSetupKey, log)
      continue
    }
    const existingStamp = existing.updatedAt ?? existing.matchEndedAt ?? existing.matchStartedAt
    if (stamp > existingStamp) map.set(log.courtSetupKey, log)
  }
  return [...map.values()]
}

function emptyTotals(key: string, name: string, playerId: string | null): PlayerTotals {
  return {
    profile_id: key,
    member_profile_id: playerId,
    display_name: name,
    avatar_url: null,
    points: 0,
    games: 0,
    wins: 0,
    losses: 0,
  }
}

export function computeFriendlySessionStandings(
  logs: MatchGestureLog[],
  scoreUnit: AmericanoScoringUnit,
  sessionRoster: CourtPlayer[] = [],
): LeaderboardEntry[] {
  const totals = new Map<string, PlayerTotals>()

  for (const player of sessionRoster) {
    const key = player.id ?? player.name
    totals.set(key, emptyTotals(key, player.name, player.id))
    if (player.avatarUrl) totals.get(key)!.avatar_url = player.avatarUrl
  }

  for (const log of latestLogsByCourt(logs)) {
    if (!log.matchEndedAt || !log.winner) continue
    const scores = teamScores(log, scoreUnit)
    if (!scores) continue
    const [scoreA, scoreB] = scores

    for (const slot of log.roster) {
      const key = rosterPlayerKey(slot)
      if (!key) continue
      const team = quadrantTeam(slot.quadrant)
      const teamScore = team === 'a' ? scoreA : scoreB
      const oppScore = team === 'a' ? scoreB : scoreA
      const cur =
        totals.get(key) ??
        emptyTotals(key, slot.name || key, slot.playerId)
      totals.set(key, {
        ...cur,
        display_name: slot.name || cur.display_name,
        member_profile_id: slot.playerId ?? cur.member_profile_id,
        points: cur.points + teamScore,
        games: cur.games + 1,
        wins: cur.wins + (teamScore > oppScore ? 1 : 0),
        losses: cur.losses + (teamScore < oppScore ? 1 : 0),
      })
    }
  }

  const rows = [...totals.values()]
    .filter((row) => row.games > 0 || sessionRoster.some((p) => (p.id ?? p.name) === row.profile_id))
    .map((row) => ({
      profile_id: row.profile_id,
      member_profile_id: row.member_profile_id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      total_points: row.points,
      games: row.games,
      wins: row.wins,
      losses: row.losses,
    }))
    .sort(
      (a, b) =>
        b.total_points - a.total_points ||
        b.games - a.games ||
        a.display_name.localeCompare(b.display_name),
    )

  return normalizeLeaderboardEntries(rows)
}
