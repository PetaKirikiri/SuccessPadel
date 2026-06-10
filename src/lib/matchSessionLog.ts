import type { CourtPlayer } from './americanoSchedule'
import { playerKey } from './courtPositionSetup'
import { agentDebugIngest } from './debug/devDebug'
import type { GestureDebugEntry } from './gestureDebugLog'
import type { Quadrant } from './gestureCapture'
import type { MatchTeam } from './types'
import type { TennisScore } from './tennisScore'
import { INITIAL_TENNIS_SCORE } from './tennisScore'
import { isFriendlySession } from './friendlyMatch'
import type { PlayerGameStats, ShotTypeBreakdown } from './playerGameStats'

/** Test mode: keep scores/stats in local logs only — no Supabase write. */
export const MATCH_PERSIST_TO_SERVER = false

const SESSIONS_KEY = 'sp-match-sessions'
const PLAYER_LOGS_KEY = 'sp-player-match-logs'
const MAX_PLAYER_ENTRIES = 40
const MAX_SESSION_GESTURES = 150

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
  /** Full gesture payloads — survives global debug-log clears. */
  gestureEntries?: GestureDebugEntry[]
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
    gestureEntries: [],
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

/** Write a full session record (e.g. hydrated from a server log for review). */
export function importMatchSession(record: MatchSessionRecord): void {
  const sessions = readSessions()
  sessions[record.id] = record
  writeSessions(sessions)
}

export function listMatchSessions(): MatchSessionRecord[] {
  return Object.values(readSessions())
}

/** Remove a session entirely (e.g. court reset back to setup). */
export function deleteMatchSession(id: string): void {
  const sessions = readSessions()
  if (sessions[id]) {
    delete sessions[id]
    writeSessions(sessions)
  }
}

export function recordMatchGesture(
  sessionId: string,
  gestureId: string,
  entry?: GestureDebugEntry,
): void {
  const sessions = readSessions()
  const session = sessions[sessionId]
  // #region agent log
  agentDebugIngest(
    'matchSessionLog.ts:recordMatchGesture',
    'gesture write to local session',
    {
      runId: 'persist-debug',
      sessionId,
      sessionExists: Boolean(session),
      gestureId,
      knownSessionKeys: Object.keys(sessions),
      gestureIdsAfter: session ? session.gestureIds.length + (session.gestureIds.includes(gestureId) ? 0 : 1) : 0,
    },
    session ? 'G' : 'H',
  )
  // #endregion
  if (!session) return
  let dirty = false
  if (!session.gestureIds.includes(gestureId)) {
    session.gestureIds = [gestureId, ...session.gestureIds]
    dirty = true
  }
  if (entry && !session.gestureEntries?.some((g) => g.id === gestureId)) {
    session.gestureEntries = [entry, ...(session.gestureEntries ?? [])].slice(0, MAX_SESSION_GESTURES)
    dirty = true
  }
  if (dirty) writeSessions(sessions)
}

function backfillSessionGestureEntries(
  sessionId: string,
  entries: GestureDebugEntry[],
): void {
  if (!entries.length) return
  const sessions = readSessions()
  const session = sessions[sessionId]
  if (!session || session.gestureEntries?.length) return
  session.gestureEntries = entries
  writeSessions(sessions)
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
  // #region agent log
  agentDebugIngest(
    'matchSessionLog.ts:recordMatchPoint',
    'point write to local session',
    {
      runId: 'persist-debug',
      sessionId,
      sessionExists: Boolean(session),
      knownSessionKeys: Object.keys(sessions),
      pointEventsAfter: session ? session.pointEvents.length + 1 : 0,
    },
    session ? 'G' : 'H',
  )
  // #endregion
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

/** Prefer session-stored gestures — survives global debug-log clears. */
export function matchStatGestures(
  sessionId: string | undefined,
  allGestures: GestureDebugEntry[],
): GestureDebugEntry[] | null {
  if (!sessionId) return null
  const session = loadMatchSession(sessionId)
  if (session?.gestureEntries?.length) {
    return session.gestureEntries
  }
  if (session?.gestureIds.length) {
    const fromLog = gesturesForSession(session, allGestures)
    if (fromLog.length) {
      backfillSessionGestureEntries(sessionId, fromLog)
      return fromLog
    }
  }
  const tagged = allGestures.filter((g) => g.matchSessionId === sessionId)
  return tagged.length ? tagged : null
}

export function sessionGestureEntries(
  session: MatchSessionRecord | null,
  allGestures: GestureDebugEntry[],
): GestureDebugEntry[] {
  if (!session) return []
  if (session.gestureEntries?.length) return session.gestureEntries
  return gesturesForSession(session, allGestures)
}

/** Oldest gesture first — storage keeps newest first. */
export function chronologicalSessionGestures(
  session: MatchSessionRecord | null,
  allGestures: GestureDebugEntry[],
): GestureDebugEntry[] {
  const entries = sessionGestureEntries(session, allGestures)
  return [...entries].reverse()
}

export function gesturesSinceLastPoint(
  chronoGestures: GestureDebugEntry[],
  chronoPoints: MatchPointEvent[],
): GestureDebugEntry[] {
  if (chronoPoints.length === 0) return chronoGestures
  const lastPoint = chronoPoints[chronoPoints.length - 1]!
  const winIdx = chronoGestures.findIndex((g) => g.id === lastPoint.winnerGestureId)
  if (winIdx < 0) return chronoGestures
  return chronoGestures.slice(winIdx + 1)
}

export function gesturesForPoint(
  chronoGestures: GestureDebugEntry[],
  chronoPoints: MatchPointEvent[],
  pointIndex: number,
): GestureDebugEntry[] {
  const point = chronoPoints[pointIndex]
  if (!point) return []
  const winIdx = chronoGestures.findIndex((g) => g.id === point.winnerGestureId)
  if (winIdx < 0) return []
  const prevWinnerId =
    pointIndex > 0 ? chronoPoints[pointIndex - 1]!.winnerGestureId : null
  const prevWinIdx = prevWinnerId
    ? chronoGestures.findIndex((g) => g.id === prevWinnerId)
    : -1
  const startIdx = prevWinIdx >= 0 ? prevWinIdx + 1 : 0
  return chronoGestures.slice(startIdx, winIdx + 1)
}

/** Oldest point first — storage keeps newest first. */
export function chronologicalPointEvents(session: MatchSessionRecord | null): MatchPointEvent[] {
  if (!session?.pointEvents.length) return []
  return [...session.pointEvents].reverse()
}

export function removeMatchGesture(sessionId: string, gestureId: string): void {
  const sessions = readSessions()
  const session = sessions[sessionId]
  if (!session) return
  session.gestureIds = session.gestureIds.filter((id) => id !== gestureId)
  if (session.gestureEntries?.length) {
    session.gestureEntries = session.gestureEntries.filter((g) => g.id !== gestureId)
  }
  writeSessions(sessions)
}

export function removeLastMatchPoint(sessionId: string): MatchPointEvent | null {
  const sessions = readSessions()
  const session = sessions[sessionId]
  if (!session?.pointEvents.length) return null
  const removed = session.pointEvents[0]!
  session.pointEvents = session.pointEvents.slice(1)
  writeSessions(sessions)
  return removed
}

export function scoreBeforeChronologicalPoint(
  events: MatchPointEvent[],
  index: number,
): TennisScore {
  if (index <= 0) return INITIAL_TENNIS_SCORE
  return events[index - 1]!.scoreAfter
}

export function pruneSessionGestures(sessionId: string, keepIds: Set<string>): void {
  const sessions = readSessions()
  const session = sessions[sessionId]
  if (!session) return
  session.gestureIds = session.gestureIds.filter((id) => keepIds.has(id))
  if (session.gestureEntries?.length) {
    session.gestureEntries = session.gestureEntries.filter((g) => keepIds.has(g.id))
  }
  writeSessions(sessions)
}

/** Drop this point and all later points (chronological index). */
export function truncatePointEventsFrom(sessionId: string, fromChronologicalIndex: number): void {
  const sessions = readSessions()
  const session = sessions[sessionId]
  if (!session) return
  const kept = chronologicalPointEvents(session).slice(0, fromChronologicalIndex)
  session.pointEvents = [...kept].reverse()
  writeSessions(sessions)
}
