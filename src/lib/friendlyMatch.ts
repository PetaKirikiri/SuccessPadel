import type { CourtPlayer } from './americanoSchedule'
import { BIA_PROFILE_ID } from './clubMemberDisplay'
import { playerKey, clearCourtPositions } from './courtPositionSetup'
import { clearGestureDebugLog } from './gestureDebugLog'
import type { Quadrant } from './gestureCapture'
import type { QuadrantPlayers } from './gesturePadPlayers'

export const UI_PROFILE_ID = 'a6f65f96-7ab1-4f56-ade2-5ef785242b75'
export { BIA_PROFILE_ID }

const DEFAULT_PLAYERS: Record<Quadrant, CourtPlayer> = {
  TL: { id: UI_PROFILE_ID, name: 'UI', avatarUrl: null },
  TR: { id: null, name: 'HAM', avatarUrl: null },
  BL: { id: null, name: 'MOOK', avatarUrl: null },
  BR: { id: BIA_PROFILE_ID, name: 'Bia', avatarUrl: null },
}

export function defaultFriendlyQuadrantPlayers(): QuadrantPlayers {
  return { ...DEFAULT_PLAYERS }
}

export function friendlySessionId(): string {
  return `friendly-${crypto.randomUUID()}`
}

export function isFriendlySession(sessionKey?: string | null): boolean {
  return Boolean(sessionKey?.startsWith('friendly-'))
}

const FRIENDLY_PLAYER_KEYS = new Set(
  Object.values(DEFAULT_PLAYERS).map(playerKey),
)

function removeLocalStorageByPrefix(prefix: string): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(prefix)) keys.push(key)
  }
  for (const key of keys) localStorage.removeItem(key)
}

function clearFriendlyPlayerMatchLogs(): void {
  try {
    const raw = localStorage.getItem('sp-player-match-logs')
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return
    for (const key of Object.keys(parsed)) {
      if (FRIENDLY_PLAYER_KEYS.has(key)) delete parsed[key]
    }
    localStorage.setItem('sp-player-match-logs', JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}

function deleteMatchSession(courtSetupKey: string): void {
  try {
    const raw = localStorage.getItem('sp-match-sessions')
    if (!raw) return
    const sessions = JSON.parse(raw) as Record<string, unknown>
    if (sessions && typeof sessions === 'object') {
      delete sessions[courtSetupKey]
      localStorage.setItem('sp-match-sessions', JSON.stringify(sessions))
    }
  } catch {
    /* ignore */
  }
}

/** Wipe gesture logs, saved pad state, and match session for one court/game. */
export function resetPadGameState(
  courtSetupKey: string,
  options?: { friendly?: boolean },
): void {
  clearGestureDebugLog()
  clearCourtPositions(courtSetupKey)
  deleteMatchSession(courtSetupKey)
  if (options?.friendly) clearFriendlyPlayerMatchLogs()
}

export function resetFriendlyMatchState(courtSetupKey?: string): void {
  clearGestureDebugLog()
  removeLocalStorageByPrefix('sp-court-pos-')
  if (courtSetupKey) {
    clearCourtPositions(courtSetupKey)
    deleteMatchSession(courtSetupKey)
  }
  clearFriendlyPlayerMatchLogs()
}

const PAD_RESET_SEEN_PREFIX = 'sp-pad-reset-seen-'

/** When padResetAt changes on the server, wipe stale on-device pad state once. */
export function applyFriendlyPadReset(courtSetupKey: string, padResetAt: string | null): void {
  if (!padResetAt) return
  const seenKey = `${PAD_RESET_SEEN_PREFIX}${courtSetupKey}`
  try {
    if (localStorage.getItem(seenKey) === padResetAt) return
    resetFriendlyMatchState(courtSetupKey)
    localStorage.setItem(seenKey, padResetAt)
  } catch {
    /* ignore */
  }
}

export function allFriendlySlotsFilled(players: QuadrantPlayers): boolean {
  return (['TL', 'TR', 'BL', 'BR'] as Quadrant[]).every((q) => players[q]?.name?.trim())
}
