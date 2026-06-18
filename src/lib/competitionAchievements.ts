import type { GameSession } from './types'
import type { CompetitionPlayer } from '../hooks/useCompetitions'
import {
  roundPlayerName,
  type ClubCourt,
  type CompetitionRound,
  type CourtMatch,
  type RoundPlayer,
} from '../hooks/useCompetitionRun'

export type Achievement = { key: string; icon: string; labelKey: string }

export type MatchAward = {
  key: string
  icon: string
  labelKey: string
  playerIds: string[]
  playerNames: string[]
  round: number
  court: string | null
  scoreFor: number
  scoreAgainst: number
}

export type CompetitionAchievements = {
  individualAchievementsByPlayerId: Record<string, Achievement[]>
  matchAwards: MatchAward[]
}

type AchievementsInput = {
  roster: CompetitionPlayer[]
  rounds: CompetitionRound[]
  courtMatches: CourtMatch[]
  clubCourts: ClubCourt[]
}

const ICON = {
  winner: '🥇',
  runnerUp: '🥈',
  thirdPlace: '🥉',
  mostWins: '⚔️',
  winStreak: '🔥',
  undefeated: '🛡️',
  bestDefense: '🛡️',
  highestScore: '💥',
  brickWall: '🧱',
  cleanSheet: '🎯',
  biggestVictory: '⚔️',
} as const

/**
 * Custom image assets per achievement key, served from /public.
 * Add a line here as new assets arrive; rendering falls back to the emoji icon.
 */
export const ACHIEVEMENT_IMAGE: Record<string, string> = {
  winner: '/achievements/winner.png',
  runnerUp: '/achievements/runner-up.png',
  thirdPlace: '/achievements/third-place.png',
  bestDefense: '/achievements/best-defense.png',
  winStreak: '/achievements/win-streak.png',
  hotStreak: '/achievements/win-streak.png',
  mostWins: '/achievements/most-wins.png',
}

const MIN_STREAK = 2
const MIN_HOT_STREAK = 3
const MIN_LIVE_GAMES = 3

function roundPlayerKey(p: RoundPlayer): string {
  return p.padel_player_id ?? p.profile_id ?? p.roster_entry_id
}

function rosterKey(sp: CompetitionPlayer): string {
  return sp.padel_player_id ?? sp.profile_id ?? sp.id
}

function parseScore(summary: string | undefined): [number, number] | null {
  const parts = summary?.split('-').map((s) => Number(s.trim()))
  if (!parts || parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null
  return [parts[0]!, parts[1]!]
}

function populatedRounds(rounds: CompetitionRound[]): CompetitionRound[] {
  return rounds.filter((r) => (r.competition_round_players ?? []).length > 0)
}

function roundFullyScored(round: CompetitionRound, courtMatches: CourtMatch[]): boolean {
  const courtIds = new Set((round.competition_round_players ?? []).map((p) => p.court_id))
  for (const courtId of courtIds) {
    const match = courtMatches.find(
      (m) => m.competition_round_id === round.id && m.court_id === courtId,
    )
    if (!match || !parseScore(match.score_summary)) return false
  }
  return courtIds.size > 0
}

function countFullyScoredRounds(rounds: CompetitionRound[], courtMatches: CourtMatch[]): number {
  return populatedRounds(rounds).filter((round) => roundFullyScored(round, courtMatches)).length
}

/** A competition is complete when explicitly marked, or every populated round has a valid score on each court. */
export function isCompetitionComplete(
  session: GameSession | null,
  rounds: CompetitionRound[],
  courtMatches: CourtMatch[],
): boolean {
  if (session?.status === 'complete') return true

  const liveRounds = populatedRounds(rounds)
  if (liveRounds.length === 0) return false

  return liveRounds.every((round) => roundFullyScored(round, courtMatches))
}

type TeamGame = {
  playerKeys: string[]
  playerNames: string[]
  round: number
  court: string | null
  scoreFor: number
  scoreAgainst: number
  won: boolean
}

export type { TeamGame }

function buildTeamGames(input: AchievementsInput): TeamGame[] {
  const { rounds, courtMatches, clubCourts } = input
  const courtNameById = new Map(clubCourts.map((c) => [c.id, c.name]))
  const games: TeamGame[] = []

  for (const match of courtMatches) {
    const score = parseScore(match.score_summary)
    if (!score) continue
    const round = rounds.find((r) => r.id === match.competition_round_id)
    if (!round) continue

    const players = (round.competition_round_players ?? []).filter(
      (p) => p.court_id === match.court_id,
    )
    if (players.length === 0) continue

    const teamA = players.filter((p) => p.team === 'a')
    const teamB = players.filter((p) => p.team === 'b')
    const courtName = courtNameById.get(match.court_id) ?? players[0]?.courts?.name ?? null
    const [a, b] = score

    const make = (team: RoundPlayer[], scoreFor: number, scoreAgainst: number): TeamGame => ({
      playerKeys: team.map(roundPlayerKey),
      playerNames: team.map(roundPlayerName),
      round: round.round_number,
      court: courtName,
      scoreFor,
      scoreAgainst,
      won: scoreFor > scoreAgainst,
    })

    if (teamA.length) games.push(make(teamA, a, b))
    if (teamB.length) games.push(make(teamB, b, a))
  }

  return games
}

type PlayerStat = {
  points: number
  conceded: number
  wins: number
  losses: number
  played: number
  results: { round: number; won: boolean }[]
}

function buildPlayerStats(teamGames: TeamGame[]): Map<string, PlayerStat> {
  const stats = new Map<string, PlayerStat>()
  for (const game of teamGames) {
    const win = game.scoreFor > game.scoreAgainst
    const loss = game.scoreFor < game.scoreAgainst
    for (const key of game.playerKeys) {
      const stat =
        stats.get(key) ?? { points: 0, conceded: 0, wins: 0, losses: 0, played: 0, results: [] }
      stat.points += game.scoreFor
      stat.conceded += game.scoreAgainst
      stat.played += 1
      if (win) stat.wins += 1
      else if (loss) stat.losses += 1
      stat.results.push({ round: game.round, won: win })
      stats.set(key, stat)
    }
  }
  return stats
}

function longestWinStreak(results: { round: number; won: boolean }[]): number {
  const sorted = [...results].sort((a, b) => a.round - b.round)
  let best = 0
  let current = 0
  for (const r of sorted) {
    if (r.won) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }
  return best
}

function currentWinStreak(results: { round: number; won: boolean }[]): number {
  const sorted = [...results].sort((a, b) => a.round - b.round)
  let streak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i]!.won) streak += 1
    else break
  }
  return streak
}

function standingsSortKeys(stats: Map<string, PlayerStat>): string[] {
  return [...stats.entries()]
    .filter(([, stat]) => stat.played > 0)
    .sort(
      (a, b) =>
        b[1].points - a[1].points ||
        b[1].played - a[1].played ||
        a[0].localeCompare(b[0]),
    )
    .map(([key]) => key)
}

export function podiumMedalForRowIndex(index: number): Achievement | null {
  if (index === 0) {
    return { key: 'winner', icon: ICON.winner, labelKey: 'achievements.winner' }
  }
  if (index === 1) {
    return { key: 'runnerUp', icon: ICON.runnerUp, labelKey: 'achievements.runnerUp' }
  }
  if (index === 2) {
    return { key: 'thirdPlace', icon: ICON.thirdPlace, labelKey: 'achievements.thirdPlace' }
  }
  return null
}

type PointsStandingsRow = { total_points: number; games: number }

/** Top three distinct point totals among active players (desc). */
export function podiumPointTiers(rows: PointsStandingsRow[]): number[] {
  return [...new Set(rows.filter((row) => row.games > 0).map((row) => row.total_points))].sort(
    (a, b) => b - a,
  ).slice(0, 3)
}

/** Podium medal from point total — tied scores share the same tier medal. */
export function podiumAchievementForPoints(
  entry: PointsStandingsRow,
  tiers: number[],
): Achievement | null {
  if (entry.games <= 0) return null
  const tierIndex = tiers.indexOf(entry.total_points)
  if (tierIndex < 0 || tierIndex > 2) return null
  return podiumMedalForRowIndex(tierIndex)
}

/** Display rank by points (1, 1, 3…) — not table row index. */
export function standingsDisplayRank(entries: PointsStandingsRow[], index: number): number {
  const row = entries[index]
  if (!row || row.games <= 0) return index + 1
  let rank = 1
  for (let i = 0; i < index; i++) {
    const prev = entries[i]!
    if (prev.games > 0 && prev.total_points > row.total_points) rank++
  }
  return rank
}

/** @deprecated Use podiumAchievementForPoints — rank alone ignores tied scores. */
export function podiumAchievementForRank(rank: number): Achievement | null {
  return rank >= 1 && rank <= 3 ? podiumMedalForRowIndex(rank - 1) : null
}

type AchievementStandingsRow = {
  profile_id: string
  member_profile_id?: string | null
  padel_player_id?: string | null
  display_name: string
  games: number
  total_points: number
}

const PODIUM_BADGE_ORDER = ['winner', 'runnerUp', 'thirdPlace'] as const

export function sortAchievementsForDisplay(badges: Achievement[]): Achievement[] {
  return [...badges].sort((a, b) => {
    const ai = PODIUM_BADGE_ORDER.indexOf(a.key as (typeof PODIUM_BADGE_ORDER)[number])
    const bi = PODIUM_BADGE_ORDER.indexOf(b.key as (typeof PODIUM_BADGE_ORDER)[number])
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    }
    return 0
  })
}

export function mergeAchievementRecords(
  ...maps: Record<string, Achievement[]>[]
): Record<string, Achievement[]> {
  const out: Record<string, Achievement[]> = {}
  for (const map of maps) {
    for (const [id, badges] of Object.entries(map)) {
      if (!badges.length) continue
      const merged = sortAchievementsForDisplay([
        ...(out[id] ?? []).filter((badge) => !badges.some((next) => next.key === badge.key)),
        ...badges,
      ])
      out[id] = merged
    }
  }
  return out
}

export function podiumAchievementsFromStandings(
  standings: AchievementStandingsRow[],
): Record<string, Achievement[]> {
  const tiers = podiumPointTiers(standings)
  const out: Record<string, Achievement[]> = {}
  for (const row of standings) {
    const medal = podiumAchievementForPoints(row, tiers)
    if (!medal) continue
    const ids = [
      row.padel_player_id,
      row.member_profile_id,
      row.profile_id,
      row.display_name,
    ].filter((id): id is string => Boolean(id))
    for (const id of ids) {
      out[id] = sortAchievementsForDisplay([medal])
    }
  }
  return out
}

function achievementsForStandingsRow(
  row: AchievementStandingsRow,
  byKey: Map<string, Achievement[]>,
): Achievement[] | null {
  const ids = [row.profile_id, row.member_profile_id, row.padel_player_id, row.display_name].filter(
    (id): id is string => Boolean(id),
  )
  for (const id of ids) {
    const list = byKey.get(id)
    if (list?.length) return list
  }
  return null
}

function mapAchievementsToStandingsRows(
  byKey: Map<string, Achievement[]>,
  standings: AchievementStandingsRow[],
): Record<string, Achievement[]> {
  const out: Record<string, Achievement[]> = {}
  for (const row of standings) {
    if (row.games <= 0) continue
    const list = achievementsForStandingsRow(row, byKey)
    if (!list?.length) continue
    const sorted = sortAchievementsForDisplay(list)
    const ids = [row.padel_player_id, row.member_profile_id, row.profile_id, row.display_name].filter(
      (id): id is string => Boolean(id),
    )
    for (const id of ids) {
      out[id] = sorted
    }
  }
  return out
}

function buildIndividualAchievements(
  stats: Map<string, PlayerStat>,
  standingsOrder?: string[],
): Map<string, Achievement[]> {
  const order = standingsOrder?.length ? standingsOrder : standingsSortKeys(stats)

  const active = order
    .map((key) => stats.get(key))
    .filter((stat): stat is PlayerStat => Boolean(stat?.played))
  const maxWins = Math.max(0, ...active.map((stat) => stat.wins))
  const maxStreak = Math.max(0, ...active.map((stat) => longestWinStreak(stat.results)))
  const minConceded = active.length ? Math.min(...active.map((stat) => stat.conceded)) : null

  const byKey = new Map<string, Achievement[]>()
  for (const [key, stat] of stats) {
    if (stat.played === 0) continue
    const list: Achievement[] = []

    if (maxWins > 0 && stat.wins === maxWins) {
      list.push({ key: 'mostWins', icon: ICON.mostWins, labelKey: 'achievements.mostWins' })
    }
    if (currentWinStreak(stat.results) >= MIN_HOT_STREAK) {
      list.push({ key: 'hotStreak', icon: ICON.winStreak, labelKey: 'achievements.hotStreak' })
    }
    if (maxStreak >= MIN_STREAK && longestWinStreak(stat.results) === maxStreak) {
      list.push({ key: 'winStreak', icon: ICON.winStreak, labelKey: 'achievements.winStreak' })
    }
    if (stat.losses === 0 && stat.played >= 1) {
      list.push({ key: 'undefeated', icon: ICON.undefeated, labelKey: 'achievements.undefeated' })
    }
    if (minConceded != null && stat.conceded === minConceded) {
      list.push({ key: 'bestDefense', icon: ICON.bestDefense, labelKey: 'achievements.bestDefense' })
    }

    if (list.length > 0) byKey.set(key, list)
  }

  const podiumRows = order
    .map((key) => stats.get(key))
    .filter((stat): stat is PlayerStat => Boolean(stat?.played))
    .map((stat) => ({ total_points: stat.points, games: stat.played }))
  const tiers = podiumPointTiers(podiumRows)

  for (const key of order) {
    const stat = stats.get(key)
    if (!stat || stat.played === 0) continue
    const medal = podiumAchievementForPoints({ total_points: stat.points, games: stat.played }, tiers)
    if (!medal) continue
    const list = byKey.get(key) ?? []
    if (!list.some((badge) => badge.key === medal.key)) list.unshift(medal)
    byKey.set(key, list)
  }

  return byKey
}

function toAward(
  key: string,
  icon: string,
  labelKey: string,
  game: TeamGame,
): MatchAward {
  return {
    key,
    icon,
    labelKey,
    playerIds: game.playerKeys,
    playerNames: game.playerNames,
    round: game.round,
    court: game.court,
    scoreFor: game.scoreFor,
    scoreAgainst: game.scoreAgainst,
  }
}

function buildMatchAwards(teamGames: TeamGame[]): MatchAward[] {
  if (teamGames.length === 0) return []
  const awards: MatchAward[] = []

  const maxFor = Math.max(...teamGames.map((g) => g.scoreFor))
  if (maxFor > 0) {
    for (const g of teamGames.filter((g) => g.scoreFor === maxFor)) {
      awards.push(toAward('highestScore', ICON.highestScore, 'achievements.highestScore', g))
    }
  }

  const minAgainst = Math.min(...teamGames.map((g) => g.scoreAgainst))
  for (const g of teamGames.filter((g) => g.scoreAgainst === minAgainst)) {
    awards.push(toAward('brickWall', ICON.brickWall, 'achievements.brickWall', g))
  }

  for (const g of teamGames.filter((g) => g.won && g.scoreAgainst === 0)) {
    awards.push(toAward('cleanSheet', ICON.cleanSheet, 'achievements.cleanSheet', g))
  }

  const wonGames = teamGames.filter((g) => g.won)
  if (wonGames.length > 0) {
    const maxDiff = Math.max(...wonGames.map((g) => g.scoreFor - g.scoreAgainst))
    if (maxDiff > 0) {
      for (const g of wonGames.filter((g) => g.scoreFor - g.scoreAgainst === maxDiff)) {
        awards.push(toAward('biggestVictory', ICON.biggestVictory, 'achievements.biggestVictory', g))
      }
    }
  }

  return awards
}

function mapAchievementsToRoster(
  achievementsByKey: Map<string, Achievement[]>,
  roster: CompetitionPlayer[],
): Record<string, Achievement[]> {
  const individualAchievementsByPlayerId: Record<string, Achievement[]> = {}
  for (const sp of roster) {
    const list = achievementsByKey.get(rosterKey(sp))
    if (!list || list.length === 0) continue
    for (const id of [sp.padel_player_id, sp.profile_id, sp.id]) {
      if (id) individualAchievementsByPlayerId[id] = list
    }
  }
  return individualAchievementsByPlayerId
}

export type SessionRosterPlayer = {
  key: string
  memberProfileId: string | null
  name: string
}

/** Shared achievement engine for any americano-style team game list (competition or friendly). */
export function achievementsFromTeamGames(
  teamGames: TeamGame[],
  roster: SessionRosterPlayer[],
  standingsOrder?: string[],
  minGamesForLive = MIN_LIVE_GAMES,
  standingsRows?: AchievementStandingsRow[],
): CompetitionAchievements {
  const podiumOnly = standingsRows?.length
    ? podiumAchievementsFromStandings(standingsRows)
    : {}

  if (teamGames.length < minGamesForLive) {
    return { individualAchievementsByPlayerId: podiumOnly, matchAwards: [] }
  }

  const stats = buildPlayerStats(teamGames)
  const achievementsByKey = buildIndividualAchievements(stats, standingsOrder)
  const fromStandings = standingsRows?.length
    ? mapAchievementsToStandingsRows(achievementsByKey, standingsRows)
    : null

  const individualAchievementsByPlayerId: Record<string, Achievement[]> = fromStandings
    ? mergeAchievementRecords(fromStandings, podiumOnly)
    : { ...podiumOnly }

  if (!fromStandings) {
    for (const [key, list] of achievementsByKey) {
      if (!list.length) continue
      individualAchievementsByPlayerId[key] = sortAchievementsForDisplay(list)
    }

    for (const player of roster) {
      const list = achievementsByKey.get(player.key)
      if (!list?.length) continue
      const ids = new Set<string>()
      if (player.memberProfileId) ids.add(player.memberProfileId)
      ids.add(player.key)
      if (player.name && player.name !== player.key) ids.add(player.name)
      for (const id of ids) {
        individualAchievementsByPlayerId[id] = sortAchievementsForDisplay(list)
      }
    }
  }

  return {
    individualAchievementsByPlayerId: mergeAchievementRecords(
      individualAchievementsByPlayerId,
      podiumOnly,
    ),
    matchAwards: buildMatchAwards(teamGames),
  }
}

/** Live leaderboard badges once enough games are scored (updates as standings shift). */
export function calculateLiveAchievements(
  input: AchievementsInput,
  standingsOrder?: string[],
): CompetitionAchievements {
  if (countFullyScoredRounds(input.rounds, input.courtMatches) < MIN_LIVE_GAMES) {
    return { individualAchievementsByPlayerId: {}, matchAwards: [] }
  }

  const teamGames = buildTeamGames(input)
  const stats = buildPlayerStats(teamGames)
  return {
    individualAchievementsByPlayerId: mapAchievementsToRoster(
      buildIndividualAchievements(stats, standingsOrder),
      input.roster,
    ),
    matchAwards: buildMatchAwards(teamGames),
  }
}

export function calculateCompetitionAchievements(
  input: AchievementsInput,
  standingsOrder?: string[],
): CompetitionAchievements {
  const teamGames = buildTeamGames(input)
  const stats = buildPlayerStats(teamGames)
  const achievementsByKey = buildIndividualAchievements(stats, standingsOrder)

  return {
    individualAchievementsByPlayerId: mapAchievementsToRoster(achievementsByKey, input.roster),
    matchAwards: buildMatchAwards(teamGames),
  }
}
