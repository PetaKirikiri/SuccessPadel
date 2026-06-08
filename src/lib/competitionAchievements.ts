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

/** A competition is complete when explicitly marked, or every populated round has a valid score on each court. */
export function isCompetitionComplete(
  session: GameSession | null,
  rounds: CompetitionRound[],
  courtMatches: CourtMatch[],
): boolean {
  if (session?.status === 'complete') return true

  const liveRounds = rounds.filter((r) => (r.competition_round_players ?? []).length > 0)
  if (liveRounds.length === 0) return false

  for (const round of liveRounds) {
    const courtIds = new Set((round.competition_round_players ?? []).map((p) => p.court_id))
    for (const courtId of courtIds) {
      const match = courtMatches.find(
        (m) => m.competition_round_id === round.id && m.court_id === courtId,
      )
      if (!match || !parseScore(match.score_summary)) return false
    }
  }
  return true
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

function podiumPoints(stats: Map<string, PlayerStat>): number[] {
  const distinct = [...new Set([...stats.values()].filter((s) => s.played > 0).map((s) => s.points))]
  return distinct.sort((a, b) => b - a).slice(0, 3)
}

function buildIndividualAchievements(
  stats: Map<string, PlayerStat>,
): Map<string, Achievement[]> {
  const [gold, silver, bronze] = podiumPoints(stats)
  const active = [...stats.values()].filter((s) => s.played > 0)
  const maxWins = Math.max(0, ...active.map((s) => s.wins))
  const maxStreak = Math.max(0, ...active.map((s) => longestWinStreak(s.results)))
  const minConceded = active.length ? Math.min(...active.map((s) => s.conceded)) : null

  const byKey = new Map<string, Achievement[]>()
  for (const [key, stat] of stats) {
    if (stat.played === 0) continue
    const list: Achievement[] = []

    if (gold != null && stat.points === gold) {
      list.push({ key: 'winner', icon: ICON.winner, labelKey: 'achievements.winner' })
    } else if (silver != null && stat.points === silver) {
      list.push({ key: 'runnerUp', icon: ICON.runnerUp, labelKey: 'achievements.runnerUp' })
    } else if (bronze != null && stat.points === bronze) {
      list.push({ key: 'thirdPlace', icon: ICON.thirdPlace, labelKey: 'achievements.thirdPlace' })
    }

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

function buildHotStreakAchievements(stats: Map<string, PlayerStat>): Map<string, Achievement[]> {
  const byKey = new Map<string, Achievement[]>()
  for (const [key, stat] of stats) {
    if (stat.played === 0 || currentWinStreak(stat.results) < MIN_HOT_STREAK) continue
    byKey.set(key, [
      { key: 'hotStreak', icon: ICON.winStreak, labelKey: 'achievements.hotStreak' },
    ])
  }
  return byKey
}

/** Live leaderboard badges from scored games so far (e.g. hot streak after 3 wins). */
export function calculateLiveAchievements(input: AchievementsInput): CompetitionAchievements {
  const teamGames = buildTeamGames(input)
  const stats = buildPlayerStats(teamGames)
  return {
    individualAchievementsByPlayerId: mapAchievementsToRoster(
      buildHotStreakAchievements(stats),
      input.roster,
    ),
    matchAwards: [],
  }
}

export function calculateCompetitionAchievements(
  input: AchievementsInput,
): CompetitionAchievements {
  const teamGames = buildTeamGames(input)
  const stats = buildPlayerStats(teamGames)
  const achievementsByKey = buildIndividualAchievements(stats)

  return {
    individualAchievementsByPlayerId: mapAchievementsToRoster(achievementsByKey, input.roster),
    matchAwards: buildMatchAwards(teamGames),
  }
}
