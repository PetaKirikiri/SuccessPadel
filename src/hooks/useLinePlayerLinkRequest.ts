import { useEffect, useState } from 'react'
import {
  createLinePlayerLinkRequest,
  getCachedLinePlayerLinkRequest,
  type LinePlayerLinkRequest,
} from '../lib/line/playerLink'

export function useLinePlayerLinkRequest(
  competitionId: string | null,
  padelPlayerId: string,
) {
  const [request, setRequest] = useState<LinePlayerLinkRequest | null>(
    () => getCachedLinePlayerLinkRequest(padelPlayerId),
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !getCachedLinePlayerLinkRequest(padelPlayerId))
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const cached = getCachedLinePlayerLinkRequest(padelPlayerId)
    if (cached) {
      setRequest(cached)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setQrDataUrl(null)
    void (async () => {
      const { request: req, error: err } = await createLinePlayerLinkRequest(
        competitionId,
        padelPlayerId,
      )
      if (!active) return
      if (err || !req) {
        setError(err ?? null)
        setRequest(null)
      } else {
        setRequest(req)
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [competitionId, padelPlayerId, attempt])

  return {
    request,
    error,
    loading,
    qrDataUrl,
    setQrDataUrl,
    retry: () => setAttempt((n) => n + 1),
  }
}
