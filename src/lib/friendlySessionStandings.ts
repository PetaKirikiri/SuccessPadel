import type { LeaderboardEntry } from './leaderboardTypes'
import type { CourtPlayer } from './americanoSchedule'
import {
  achievementsFromTeamGames,
  type CompetitionAchievements,
  type TeamGame,
} from './competitionAchievements'
import type { AmericanoScoringUnit } from './competitionPresets'
import {
  friendlyScheduleLive,
  friendlyStartsAtIso,
  type FriendlyOrganizedConfig,
} from './friendlyGames'
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
  draws: number
}

function rosterKeyLookup(sessionRoster: CourtPlayer[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const player of sessionRoster) {
    const key = player.id ?? player.name
    map.set(key, key)
    if (player.id) map.set(player.id, key)
    map.set(player.name, key)
  }
  return map
}

function canonicalRosterKey(raw: string, lookup: Map<string, string>): string {
  return lookup.get(raw) ?? raw
}

function rosterPlayerKey(
  slot: GameLogRosterSlot,
  lookup?: Map<string, string>,
): string | null {
  const raw = slot.playerId ?? (slot.name.trim() || null)
  if (!raw) return null
  return lookup ? canonicalRosterKey(raw, lookup) : raw
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
    draws: 0,
  }
}

/** Ignore pre-start test scores until the scheduled session time. */
export function filterFriendlyMatchLogsForSchedule(
  logs: MatchGestureLog[],
  config: FriendlyOrganizedConfig,
  nowMs = Date.now(),
): MatchGestureLog[] {
  if (!friendlyScheduleLive(config, nowMs)) return []
  const startsAt = friendlyStartsAtIso(config)
  if (!startsAt) return logs
  const startsAtMs = Date.parse(startsAt)
  if (!Number.isFinite(startsAtMs)) return logs
  return logs.filter((log) => {
    const stamp = Date.parse(log.matchStartedAt)
    return Number.isFinite(stamp) && stamp >= startsAtMs
  })
}

export function computeFriendlySessionStandings(
  logs: MatchGestureLog[],
  scoreUnit: AmericanoScoringUnit,
  sessionRoster: CourtPlayer[] = [],
): LeaderboardEntry[] {
  const totals = new Map<string, PlayerTotals>()
  const keyLookup = rosterKeyLookup(sessionRoster)
  const rosterByKey = new Map(sessionRoster.map((p) => [p.id ?? p.name, p]))

  for (const player of sessionRoster) {
    const key = player.id ?? player.name
    totals.set(key, {
      ...emptyTotals(key, player.name, player.id),
      avatar_url: player.avatarUrl ?? null,
    })
  }

  for (const log of latestLogsByCourt(logs)) {
    if (!log.matchEndedAt || !log.winner) continue
    const scores = teamScores(log, scoreUnit)
    if (!scores) continue
    const [scoreA, scoreB] = scores

    for (const slot of log.roster) {
      const key = rosterPlayerKey(slot, keyLookup)
      if (!key) continue
      const team = quadrantTeam(slot.quadrant)
      const teamScore = team === 'a' ? scoreA : scoreB
      const oppScore = team === 'a' ? scoreB : scoreA
      const rosterPlayer = rosterByKey.get(key)
      const cur =
        totals.get(key) ??
        emptyTotals(key, slot.name || key, slot.playerId)
      totals.set(key, {
        ...cur,
        display_name: slot.name || rosterPlayer?.name || cur.display_name,
        member_profile_id: slot.playerId ?? rosterPlayer?.id ?? cur.member_profile_id,
        avatar_url: cur.avatar_url ?? rosterPlayer?.avatarUrl ?? null,
        points: cur.points + teamScore,
        games: cur.games + 1,
        wins: cur.wins + (teamScore > oppScore ? 1 : 0),
        losses: cur.losses + (teamScore < oppScore ? 1 : 0),
        draws: cur.draws + (teamScore === oppScore ? 1 : 0),
      })
    }
  }

  const rosterOrder = new Map(sessionRoster.map((p, i) => [p.id ?? p.name, i]))

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
      draws: row.draws,
    }))
    .sort(
      (a, b) =>
        b.total_points - a.total_points ||
        b.games - a.games ||
        (rosterOrder.get(a.profile_id) ?? 999) - (rosterOrder.get(b.profile_id) ?? 999) ||
        a.display_name.localeCompare(b.display_name),
    )

  return normalizeLeaderboardEntries(rows)
}

function buildFriendlyTeamGames(
  logs: MatchGestureLog[],
  scoreUnit: AmericanoScoringUnit,
  sessionRoster: CourtPlayer[] = [],
): TeamGame[] {
  const keyLookup = rosterKeyLookup(sessionRoster)
  const games: TeamGame[] = []

  for (const log of latestLogsByCourt(logs)) {
    if (!log.matchEndedAt || !log.winner) continue
    const scores = teamScores(log, scoreUnit)
    if (!scores) continue
    const [scoreA, scoreB] = scores
    const round = Number(log.gameNumber) || 0
    const court = log.courtId

    const teamA = log.roster.filter((slot) => quadrantTeam(slot.quadrant) === 'a')
    const teamB = log.roster.filter((slot) => quadrantTeam(slot.quadrant) === 'b')

    const makeTeamGame = (
      team: GameLogRosterSlot[],
      scoreFor: number,
      scoreAgainst: number,
    ): TeamGame => ({
      playerKeys: team
        .map((slot) => rosterPlayerKey(slot, keyLookup))
        .filter((key): key is string => Boolean(key)),
      playerNames: team.map((slot) => slot.name).filter(Boolean),
      round,
      court,
      scoreFor,
      scoreAgainst,
      won: scoreFor > scoreAgainst,
    })

    if (teamA.length) games.push(makeTeamGame(teamA, scoreA, scoreB))
    if (teamB.length) games.push(makeTeamGame(teamB, scoreB, scoreA))
  }

  return games
}

export function calculateFriendlySessionAchievements(
  logs: MatchGestureLog[],
  scoreUnit: AmericanoScoringUnit,
  sessionRoster: CourtPlayer[] = [],
  standings: LeaderboardEntry[] = [],
): CompetitionAchievements {
  const teamGames = buildFriendlyTeamGames(logs, scoreUnit, sessionRoster)
  const standingsOrder = standings.filter((row) => row.games > 0).map((row) => row.profile_id)
  const completedCourts = new Set(
    logs.filter((log) => log.matchEndedAt).map((log) => log.courtSetupKey),
  ).size
  const minTeamGames = completedCourts >= 1 ? 1 : 3
  const activeStandings = standings.filter((row) => row.games > 0)
  return achievementsFromTeamGames(
    teamGames,
    sessionRoster.map((player) => ({
      key: player.id ?? player.name,
      memberProfileId: player.id,
      name: player.name,
    })),
    standingsOrder,
    minTeamGames,
    activeStandings,
  )
}
