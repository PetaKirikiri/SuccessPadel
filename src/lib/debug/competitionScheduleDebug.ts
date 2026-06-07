import { isLocalDebugIngestEnabled, postLocalDebugIngest } from './localIngest'

const SESSION = '8bc41b'
const STORAGE_KEY = 'debug-8bc41b'

export type ScheduleDebugEntry = {
  sessionId: string
  location: string
  message: string
  hypothesisId: string
  data: Record<string, unknown>
  timestamp: number
}

export function formatMatchup(teamA: string[], teamB: string[]): string {
  return `${teamA.join(' + ')} vs ${teamB.join(' + ')}`
}

export function competitionScheduleDebugLog(
  location: string,
  message: string,
  hypothesisId: string,
  data: Record<string, unknown> = {},
) {
  const entry: ScheduleDebugEntry = {
    sessionId: SESSION,
    location,
    message,
    hypothesisId,
    data,
    timestamp: Date.now(),
  }
  // #region agent log
  try {
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ScheduleDebugEntry[]
    prev.push(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(-120)))
  } catch {
    /* ignore */
  }
  if (isLocalDebugIngestEnabled()) postLocalDebugIngest(entry, SESSION)
  // #endregion
}
