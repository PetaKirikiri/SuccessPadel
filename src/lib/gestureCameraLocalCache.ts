import type { MatchGestureLog } from './matchLogServer'
import { gamesManualOverrideAt } from './gestureCameraScore'

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

/** Prefer the most recently updated log; event count only breaks ties (supports multi-undo). */
export function newerGestureCameraLog(
  a: MatchGestureLog | null,
  b: MatchGestureLog | null,
): MatchGestureLog | null {
  if (!a) return b
  if (!b) return a
  const aTs = Date.parse(a.updatedAt ?? '') || 0
  const bTs = Date.parse(b.updatedAt ?? '') || 0
  if (aTs !== bTs) return bTs > aTs ? b : a
  if (b.pointEvents.length > a.pointEvents.length) return b
  if (a.pointEvents.length > b.pointEvents.length) return a
  const aEnded = Boolean(a.matchEndedAt)
  const bEnded = Boolean(b.matchEndedAt)
  if (aEnded !== bEnded) return aEnded ? b : a
  return b
}

/** Keep optimistic local score while a background save is still in flight. */
export function shouldPreferLocalGestureLog(
  local: MatchGestureLog | null,
  remote: MatchGestureLog | null,
): boolean {
  if (!local) return false
  if (!remote) return true
  const remoteManual = gamesManualOverrideAt(remote)
  if (remoteManual) {
    const localManual = gamesManualOverrideAt(local)
    if (!localManual || Date.parse(remoteManual) > Date.parse(localManual)) return false
  }
  if (local.pointEvents.length > remote.pointEvents.length) return true
  return newerGestureCameraLog(local, remote) === local
}

/** Prefer the log with more committed points; timestamp only breaks ties (undo). */
export function displayGestureCameraLog(
  a: MatchGestureLog | null,
  b: MatchGestureLog | null,
): MatchGestureLog | null {
  if (!a) return b
  if (!b) return a
  const aManual = gamesManualOverrideAt(a)
  const bManual = gamesManualOverrideAt(b)
  if (aManual && !bManual) return a
  if (bManual && !aManual) return b
  if (aManual && bManual) {
    return Date.parse(aManual) >= Date.parse(bManual) ? a : b
  }
  if (b.pointEvents.length !== a.pointEvents.length) {
    return b.pointEvents.length > a.pointEvents.length ? b : a
  }
  return newerGestureCameraLog(a, b)
}

/** Merge fetched logs with prior state so a stale read cannot rewind live scores. */
export function mergeMatchGestureLogsByCourt(
  prev: MatchGestureLog[],
  incoming: MatchGestureLog[],
): MatchGestureLog[] {
  const prevByKey = new Map(prev.map((log) => [log.courtSetupKey, log]))
  const merged = new Map<string, MatchGestureLog>()
  for (const log of incoming) {
    const prior = prevByKey.get(log.courtSetupKey) ?? null
    merged.set(log.courtSetupKey, displayGestureCameraLog(prior, log) ?? log)
  }
  for (const log of prev) {
    if (!merged.has(log.courtSetupKey)) merged.set(log.courtSetupKey, log)
  }
  return [...merged.values()]
}
