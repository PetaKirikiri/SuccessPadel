import type { CourtPlayer } from './americanoSchedule'
import { playerKey } from './courtPositionSetup'
import type { GestureDebugEntry } from './gestureDebugLog'
import type { Quadrant } from './gestureCapture'
import type { MatchTeam } from './types'
import type { TennisScore } from './tennisScore'
import { isFriendlySession } from './friendlyMatch'
import type { PlayerGameStats, ShotTypeBreakdown } from './playerGameStats'

/** Test mode: keep scores/stats in local logs only — no Supabase write. */
export const MATCH_PERSIST_TO_SERVER = false

const SESSIONS_KEY = 'sp-match-sessions'
const PLAYER_LOGS_KEY = 'sp-player-match-logs'
const MAX_PLAYER_ENTRIES = 40

export type PlayerStatsSnapshot = {
  playerKey: string
  playerId: string | null
  displayName: string
  quadrant: Quadrant
  totalShots: number
  scored: number
  fouls: number
  unregistered: number
  successRate: number
  byType: ShotTypeBreakdown
}

export type MatchPointEvent = {
  at: string
  winner: MatchTeam
  scoreAfter: TennisScore
  winnerGestureId: string
  loserGestureId: string
  winnerQuadrant: string
  loserQuadrant: string
  isServe?: boolean
  /** @deprecated use winnerGestureId */
  gestureId?: string
}

export type MatchSessionRecord = {
  id: string
  competitionId?: string
  gameNumber?: string
  courtId?: string
  matchStartedAt: string
  matchEndedAt?: string
  finalScore?: TennisScore
  winner?: MatchTeam
  gestureIds: string[]
  pointEvents: MatchPointEvent[]
  playerStats?: PlayerStatsSnapshot[]
  savedLocally: boolean
  isFriendly?: boolean
}

export type PlayerMatchLogEntry = {
  matchSessionId: string
  at: string
  competitionId?: string
  gameNumber?: string
  courtId?: string
  finalScore: TennisScore
  team: MatchTeam
  won: boolean
  stats: PlayerStatsSnapshot
}

function readSessions(): Record<string, MatchSessionRecord> {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, MatchSessionRecord>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeSessions(sessions: Record<string, MatchSessionRecord>): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  } catch {
    /* ignore */
  }
}

function readPlayerLogs(): Record<string, PlayerMatchLogEntry[]> {
  try {
    const raw = localStorage.getItem(PLAYER_LOGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, PlayerMatchLogEntry[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePlayerLogs(logs: Record<string, PlayerMatchLogEntry[]>): void {
  try {
    localStorage.setItem(PLAYER_LOGS_KEY, JSON.stringify(logs))
  } catch {
    /* ignore */
  }
}

export function snapshotFromPlayerStats(stats: PlayerGameStats): PlayerStatsSnapshot {
  return {
    playerKey: playerKey(stats.player),
    playerId: stats.player.id,
    displayName: stats.displayName,
    quadrant: stats.quadrant,
    totalShots: stats.totalShots,
    scored: stats.scored,
    fouls: stats.fouls,
    unregistered: stats.unregistered,
    successRate: stats.successRate,
    byType: stats.byType,
  }
}

export function ensureMatchSession(opts: {
  id: string
  competitionId?: string
  gameNumber?: string
  courtId?: string
  matchStartedAt: string
  isFriendly?: boolean
}): MatchSessionRecord {
  const existing = loadMatchSession(opts.id)
  if (existing) {
    if (opts.isFriendly && !existing.isFriendly) {
      const sessions = readSessions()
      sessions[opts.id] = { ...existing, isFriendly: true }
      writeSessions(sessions)
      return sessions[opts.id]!
    }
    return existing
  }
  return startMatchSession(opts)
}

export function startMatchSession(opts: {
  id: string
  competitionId?: string
  gameNumber?: string
  courtId?: string
  matchStartedAt: string
  isFriendly?: boolean
}): MatchSessionRecord {
  const sessions = readSessions()
  const session: MatchSessionRecord = {
    id: opts.id,
    competitionId: opts.competitionId,
    gameNumber: opts.gameNumber,
    courtId: opts.courtId,
    matchStartedAt: opts.matchStartedAt,
    gestureIds: [],
    pointEvents: [],
    savedLocally: false,
    isFriendly: opts.isFriendly ?? isFriendlySession(opts.id),
  }
  sessions[opts.id] = session
  writeSessions(sessions)
  return session
}

export function loadMatchSession(id: string): MatchSessionRecord | null {
  return readSessions()[id] ?? null
}

export function listMatchSessions(): MatchSessionRecord[] {
  return Object.values(readSessions())
}

export function recordMatchGesture(sessionId: string, gestureId: string): void {
  const sessions = readSessions()
  const session = sessions[sessionId]
  if (!session) return
  if (!session.gestureIds.includes(gestureId)) {
    session.gestureIds = [gestureId, ...session.gestureIds]
    writeSessions(sessions)
  }
}

export function attachLoserGestureToPoint(
  sessionId: string,
  winnerGestureId: string,
  loserGestureId: string,
  loserQuadrant: string,
): void {
  const sessions = readSessions()
  const session = sessions[sessionId]
  if (!session) return

  const idx = session.pointEvents.findIndex((event) => event.winnerGestureId === winnerGestureId)
  if (idx < 0) return

  session.pointEvents[idx] = {
    ...session.pointEvents[idx]!,
    loserGestureId,
    loserQuadrant,
  }
  writeSessions(sessions)
}

export function recordMatchPoint(
  sessionId: string,
  event: Omit<MatchPointEvent, 'at'> & { at?: string },
): void {
  const sessions = readSessions()
  const session = sessions[sessionId]
  if (!session) return
  session.pointEvents = [
    {
      at: event.at ?? new Date().toISOString(),
      winner: event.winner,
      scoreAfter: event.scoreAfter,
      winnerGestureId: event.winnerGestureId,
      loserGestureId: event.loserGestureId,
      winnerQuadrant: event.winnerQuadrant,
      loserQuadrant: event.loserQuadrant,
      isServe: event.isServe,
      gestureId: event.winnerGestureId,
    },
    ...session.pointEvents,
  ]
  writeSessions(sessions)
}

function quadrantTeam(q: Quadrant): MatchTeam {
  return q === 'TL' || q === 'TR' ? 'a' : 'b'
}

function appendPlayerLog(
  player: CourtPlayer,
  entry: Omit<PlayerMatchLogEntry, 'stats'> & { stats: PlayerStatsSnapshot },
): void {
  const key = playerKey(player)
  const logs = readPlayerLogs()
  const list = logs[key] ?? []
  logs[key] = [entry, ...list].slice(0, MAX_PLAYER_ENTRIES)
  writePlayerLogs(logs)
}

export function finalizeMatchSession(opts: {
  sessionId: string
  finalScore: TennisScore
  winner: MatchTeam
  playerStats: PlayerGameStats[]
  isFriendly?: boolean
}): MatchSessionRecord | null {
  const sessions = readSessions()
  const session = sessions[opts.sessionId]
  if (!session) return null

  const snapshots = opts.playerStats.map(snapshotFromPlayerStats)
  session.matchEndedAt = new Date().toISOString()
  session.finalScore = opts.finalScore
  session.winner = opts.winner
  session.playerStats = snapshots
  session.savedLocally = true
  session.isFriendly = opts.isFriendly ?? isFriendlySession(opts.sessionId)
  writeSessions(sessions)

  for (const row of opts.playerStats) {
    const team = quadrantTeam(row.quadrant)
    appendPlayerLog(row.player, {
      matchSessionId: opts.sessionId,
      at: session.matchEndedAt,
      competitionId: session.competitionId,
      gameNumber: session.gameNumber,
      courtId: session.courtId,
      finalScore: opts.finalScore,
      team,
      won: team === opts.winner,
      stats: snapshotFromPlayerStats(row),
    })
  }

  return session
}

export function readPlayerMatchLogs(player: CourtPlayer): PlayerMatchLogEntry[] {
  return readPlayerLogs()[playerKey(player)] ?? []
}

export function gesturesForSession(
  session: MatchSessionRecord,
  allGestures: GestureDebugEntry[],
): GestureDebugEntry[] {
  const ids = new Set(session.gestureIds)
  return allGestures.filter((g) => ids.has(g.id))
}
