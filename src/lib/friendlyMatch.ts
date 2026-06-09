import type { CourtPlayer } from './americanoSchedule'
import { playerKey } from './courtPositionSetup'
import { clearGestureDebugLog } from './gestureDebugLog'
import type { Quadrant } from './gestureCapture'
import type { QuadrantPlayers } from './gesturePadPlayers'

export const UI_PROFILE_ID = 'a6f65f96-7ab1-4f56-ade2-5ef785242b75'
export const BIA_PROFILE_ID = '69666c11-7080-44ba-bb24-d7271e542df2'

const DEFAULT_PLAYERS: Record<Quadrant, CourtPlayer> = {
  TL: { id: UI_PROFILE_ID, name: 'UI', avatarUrl: null },
  TR: { id: null, name: 'HAM', avatarUrl: null },
  BL: { id: null, name: 'MOOK', avatarUrl: null },
  BR: { id: BIA_PROFILE_ID, name: 'BIA', avatarUrl: null },
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

export function resetFriendlyMatchState(courtSetupKey?: string): void {
  clearGestureDebugLog()
  removeLocalStorageByPrefix('sp-court-pos-')
  if (courtSetupKey) {
    try {
      const raw = localStorage.getItem('sp-match-sessions')
      if (raw) {
        const sessions = JSON.parse(raw) as Record<string, unknown>
        if (sessions && typeof sessions === 'object') {
          delete sessions[courtSetupKey]
          localStorage.setItem('sp-match-sessions', JSON.stringify(sessions))
        }
      }
    } catch {
      /* ignore */
    }
  }
  clearFriendlyPlayerMatchLogs()
}

export function allFriendlySlotsFilled(players: QuadrantPlayers): boolean {
  return (['TL', 'TR', 'BL', 'BR'] as Quadrant[]).every((q) => players[q]?.name?.trim())
}
