import { useCallback, useEffect, useState } from 'react'
import { probeLineClientProfile, type LineClientStatus } from '../lib/line/clientProfile'
import { hasLiffId } from '../lib/line/liff'

export function useLineClientProfile() {
  const [status, setStatus] = useState<LineClientStatus | null>(null)
  const [loading, setLoading] = useState(() => hasLiffId())

  const refresh = useCallback(async (log = false) => {
    if (!hasLiffId()) {
      setStatus(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    const next = await probeLineClientProfile(log)
    setStatus(next)
    setLoading(false)
    if (next.profile || next.lineLoggedIn) {
      window.dispatchEvent(new CustomEvent('successpadel:line-profile-ready', { detail: next }))
    }
    return next
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  return {
    ...status,
    loading,
    refresh,
    displayName: status?.profile?.display_name ?? null,
    pictureUrl: status?.profile?.picture_url ?? null,
  }
}
