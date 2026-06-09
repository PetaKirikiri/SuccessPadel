import type { GestureAnalysis } from './gestureAnalysis'

export type GestureDebugEntry = GestureAnalysis & {
  id: string
  at: string
  gameNumber?: string
  competitionId?: string
  courtId?: string
  matchSessionId?: string
}

const STORAGE_KEY = 'sp-gesture-debug-log'
const MAX_ENTRIES = 120

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function readGestureDebugLog(): GestureDebugEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GestureDebugEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendGestureDebugEntry(
  analysis: GestureAnalysis,
  context?: {
    gameNumber?: string
    competitionId?: string
    courtId?: string
    matchSessionId?: string
  },
): GestureDebugEntry {
  const entry: GestureDebugEntry = {
    ...analysis,
    id: newId(),
    at: new Date().toISOString(),
    gameNumber: context?.gameNumber,
    competitionId: context?.competitionId,
    courtId: context?.courtId,
    matchSessionId: context?.matchSessionId,
  }

  const prev = readGestureDebugLog()
  const next = [entry, ...prev].slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* storage full — drop oldest */
  }
  return entry
}

export function clearGestureDebugLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function exportGestureDebugLogJson(entries: GestureDebugEntry[]): string {
  return JSON.stringify(entries, null, 2)
}

export function groupByCode(entries: GestureDebugEntry[]): Map<string, GestureDebugEntry[]> {
  const map = new Map<string, GestureDebugEntry[]>()
  for (const entry of entries) {
    const list = map.get(entry.code) ?? []
    list.push(entry)
    map.set(entry.code, list)
  }
  return map
}

export function distinctPatternKeys(entries: GestureDebugEntry[]): string[] {
  return [...new Set(entries.map((e) => e.patternKey))]
}
