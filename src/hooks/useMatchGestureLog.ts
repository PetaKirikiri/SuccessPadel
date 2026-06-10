import { useCallback, useEffect, useState } from 'react'
import {
  fetchFriendlySessionMatchLog,
  fetchMatchGestureLog,
  type MatchGestureLog,
} from '../lib/matchLogServer'

/**
 * @param courtSetupKey exact key the pad saved under.
 * @param opts.friendlySessionFallback when the exact key has no row, fall back
 *   to the latest log for this friendly session (key is treated as session id).
 */
export function useMatchGestureLog(
  courtSetupKey: string | undefined,
  opts?: { friendlySessionFallback?: boolean },
) {
  const [log, setLog] = useState<MatchGestureLog | null>(null)
  const [loading, setLoading] = useState(Boolean(courtSetupKey))
  const sessionFallback = opts?.friendlySessionFallback ?? false

  const refresh = useCallback(async () => {
    if (!courtSetupKey) {
      setLog(null)
      setLoading(false)
      return
    }
    setLoading(true)
    let remote = await fetchMatchGestureLog(courtSetupKey)
    if (!remote && sessionFallback) {
      remote = await fetchFriendlySessionMatchLog(courtSetupKey)
    }
    setLog(remote)
    setLoading(false)
  }, [courtSetupKey, sessionFallback])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { log, loading, refresh }
}
