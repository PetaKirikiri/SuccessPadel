import { useEffect, useRef, useState } from 'react'
import type { LeaderboardEntry } from '../lib/leaderboardTypes'
import { readMovementSnapshot, updateMovement, type MovementSnapshot } from '../lib/leaderboardMovement'

export function useLeaderboardMovement(scope: string | null, entries: LeaderboardEntry[]) {
  const cache = useRef<{ key: string; snapshot: MovementSnapshot | null } | null>(null)
  const [display, setDisplay] = useState<{ key: string; snapshot: MovementSnapshot | null } | null>(null)
  const key = scope ? 'padel:rank-movement:v1:' + scope : null
  useEffect(() => {
    if (!key || !entries.length) return
    let previous = cache.current?.key === key ? cache.current.snapshot : null
    try {
      // Also share state between the compact and full leaderboard instances.
      previous = readMovementSnapshot(localStorage.getItem(key)) ?? previous
    } catch { /* Storage may be disabled; retain the in-memory baseline. */ }
    const snapshot = updateMovement(previous, entries)
    cache.current = { key, snapshot }
    setDisplay(current => current?.key === key && current.snapshot === snapshot ? current : { key, snapshot })
    try { localStorage.setItem(key, JSON.stringify(snapshot)) } catch { /* Nonessential cache. */ }
  }, [key, entries])
  return key && display?.key === key ? display.snapshot?.movement ?? {} : {}
}
