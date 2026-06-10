import type { GestureAnalysis } from './gestureAnalysis'
import type { HeatMapPoint, HeatMapPathPoint } from './courtHalfCapture'
import type { NormalizedPoint, Quadrant } from './gestureCapture'
import type { RallyWheelShot, ShotWaveOption } from './rallyShotWheel'

export type GestureDebugEntry = GestureAnalysis & {
  id: string
  at: string
  gameNumber?: string
  competitionId?: string
  courtId?: string
  matchSessionId?: string
  /** Player who hit the shot. */
  actorQuadrant?: Quadrant
  /** Pad coords where the player was placed (shot taken from). */
  shotOrigin?: NormalizedPoint
  /** Stroke start on the actor's team half (net = 0, baseline = 1). */
  heatMapPoint?: HeatMapPoint
  heatMapStart?: HeatMapPoint
  heatMapEnd?: HeatMapPoint
  /** Full stroke in half-court coordinates — for heat maps. */
  heatMapPath?: HeatMapPathPoint[]
  /** Raw pad coordinates (0–1) of the drawn stroke. */
  drawPath?: NormalizedPoint[]
  /** Scoring outcome when this gesture ended a serve attempt. */
  scoringIntent?: 'second_serve' | 'serve_in' | 'foul'
  /** Ball-path exchange — wheel picks for attacker and defender. */
  attackerShot?: RallyWheelShot
  defenderShot?: RallyWheelShot
  /** Second-wave refinement (OH extension or FH/BH spin). */
  attackerWave?: ShotWaveOption
  defenderWave?: ShotWaveOption
  /** Shot power 0..1 from how far the coin was pulled out. */
  attackerPower?: number
  defenderPower?: number
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
  analysis: GestureAnalysis &
    Partial<
      Pick<
        GestureDebugEntry,
        | 'actorQuadrant'
        | 'heatMapPoint'
        | 'heatMapStart'
        | 'heatMapEnd'
        | 'heatMapPath'
        | 'drawPath'
        | 'shotOrigin'
        | 'scoringIntent'
        | 'attackerShot'
        | 'defenderShot'
      >
    >,
  context?: {
    gameNumber?: string
    competitionId?: string
    courtId?: string
    matchSessionId?: string
  },
  id?: string,
): GestureDebugEntry {
  const entry: GestureDebugEntry = {
    ...analysis,
    id: id ?? newId(),
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

export function removeGestureDebugEntry(id: string): void {
  try {
    const prev = readGestureDebugLog()
    const next = prev.filter((e) => e.id !== id)
    if (next.length === prev.length) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/** Replace all debug-log gestures for one match session (DB timeline restore). */
export function importGesturesForSession(
  sessionId: string,
  entries: GestureDebugEntry[],
): void {
  try {
    const others = readGestureDebugLog().filter((e) => e.matchSessionId !== sessionId)
    const tagged = entries.map((e) => ({ ...e, matchSessionId: sessionId }))
    const next = [...tagged, ...others].slice(0, MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
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
