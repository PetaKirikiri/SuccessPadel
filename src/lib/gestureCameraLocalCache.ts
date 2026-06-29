import type { MatchGestureLog } from './matchLogServer'

const KEY_PREFIX = 'sp-gesture-cam-log:'

function storageKey(courtSetupKey: string): string {
  return `${KEY_PREFIX}${courtSetupKey}`
}

export function readLocalGestureCameraLog(courtSetupKey: string): MatchGestureLog | null {
  try {
    const raw = sessionStorage.getItem(storageKey(courtSetupKey))
    if (!raw) return null
    return JSON.parse(raw) as MatchGestureLog
  } catch {
    return null
  }
}

export function writeLocalGestureCameraLog(courtSetupKey: string, log: MatchGestureLog | null): void {
  try {
    if (!log) {
      sessionStorage.removeItem(storageKey(courtSetupKey))
      return
    }
    sessionStorage.setItem(storageKey(courtSetupKey), JSON.stringify(log))
  } catch {
    // Scoring still works in memory if storage is unavailable.
  }
}

/** Prefer the log with more committed points; on a tie prefer still-active (no matchEndedAt). */
export function newerGestureCameraLog(
  a: MatchGestureLog | null,
  b: MatchGestureLog | null,
): MatchGestureLog | null {
  if (!a) return b
  if (!b) return a
  if (b.pointEvents.length > a.pointEvents.length) return b
  if (a.pointEvents.length > b.pointEvents.length) return a
  const aEnded = Boolean(a.matchEndedAt)
  const bEnded = Boolean(b.matchEndedAt)
  if (aEnded !== bEnded) return aEnded ? b : a
  const aTs = Date.parse(a.updatedAt ?? '') || 0
  const bTs = Date.parse(b.updatedAt ?? '') || 0
  return bTs > aTs ? b : a
}
