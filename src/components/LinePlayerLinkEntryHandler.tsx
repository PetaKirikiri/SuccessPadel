import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  buildLineAuthorizeUrl,
  competitionPathAfterLink,
  completeLinePlayerLinkWithLiff,
  linkTokenFromLocation,
  shouldProcessLineLinkEntry,
} from '../lib/line/playerLink'
import { detectInLineClient, initLiff, isInLineClient } from '../lib/line/liff'
import { LineSigningInScreen } from './LineSigningInScreen'

/** Opened from LINE QR (liff.line.me/...?lpl=) — link guest scores inside the LINE app. */
export function LinePlayerLinkEntryHandler() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const linkToken = linkTokenFromLocation(search)
  const hasOAuthCode = new URLSearchParams(search).has('code')

  useEffect(() => {
    if (!linkToken || hasOAuthCode) return
    if (!shouldProcessLineLinkEntry(linkToken)) return

    let active = true

    void (async () => {
      try {
        await initLiff()
      } catch {
        /* Safari / external */
      }

      const inClient = (await detectInLineClient()) || isInLineClient()
      if (!active) return

      if (inClient) {
        const { competitionId, error: linkErr } = await completeLinePlayerLinkWithLiff(linkToken)
        if (!active) return
        if (linkErr) {
          setError(linkErr)
          return
        }
        navigate(competitionPathAfterLink(competitionId), { replace: true })
        return
      }

      window.location.assign(buildLineAuthorizeUrl(linkToken))
    })()

    return () => {
      active = false
    }
  }, [linkToken, hasOAuthCode, search, navigate])

  if (!linkToken || hasOAuthCode) return null
  if (error) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-bg px-4">
        <div className="login-panel max-w-sm space-y-3 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-brand-muted">
            Ask the organiser for a fresh QR, or open the competition in Safari and tap LINE again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <LineSigningInScreen message="Linking your LINE account…" />
    </div>
  )
}
