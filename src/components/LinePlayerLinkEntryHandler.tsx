import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { lineOAuthCallbackCode } from '../lib/line/oauth'
import {
  completeLinePlayerLinkInLiff,
  competitionIdFromPlayerLinkSearch,
  linkTokenFromLocation,
  rememberPlayerLinkCompetition,
  resolveCompetitionPathAfterLink,
  startPlayerLinkOAuth,
} from '../lib/line/playerLink'
import { detectInLineClient, initLiff, isLineLiffBrowser } from '../lib/line/liff'

/**
 * QR → LINE in-app browser (LIFF).
 * Complete link here via LIFF + Supabase — no Safari handoff.
 * Safari/system browser only when opened outside LINE.
 */
export function LinePlayerLinkEntryHandler() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const oauthStarted = useRef(false)
  const linking = useRef(false)
  const [message, setMessage] = useState('Linking your LINE account…')
  const [error, setError] = useState<string | null>(null)

  const linkToken = linkTokenFromLocation(search)
  const competitionId = competitionIdFromPlayerLinkSearch(search)
  const hasOAuthCode = Boolean(lineOAuthCallbackCode(search))

  useEffect(() => {
    if (!linkToken || hasOAuthCode) return

    let active = true

    void (async () => {
      if (linkToken && competitionId) {
        rememberPlayerLinkCompetition(linkToken, competitionId)
      }

      try {
        await initLiff()
      } catch {
        /* not LIFF */
      }

      const inLine = isLineLiffBrowser() || (await detectInLineClient())
      if (!active) return

      if (inLine) {
        if (linking.current) return
        linking.current = true
        setMessage('Linking your LINE account…')

        const { competitionId: linkedCid, redirected, error: linkErr } =
          await completeLinePlayerLinkInLiff(linkToken)
        if (!active) return
        if (redirected) return
        if (linkErr) {
          setError(linkErr)
          linking.current = false
          return
        }

        navigate(resolveCompetitionPathAfterLink(linkedCid, search), { replace: true })
        return
      }

      if (oauthStarted.current) return
      oauthStarted.current = true
      setMessage('Opening LINE login…')
      startPlayerLinkOAuth(linkToken)
    })()

    return () => {
      active = false
    }
  }, [linkToken, hasOAuthCode, competitionId, search, navigate])

  if (!linkToken || hasOAuthCode) return null

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-white px-6">
      {error ? (
        <p className="text-center text-sm text-red-600">{error}</p>
      ) : (
        <p className="text-center text-sm text-neutral-500">{message}</p>
      )}
    </div>
  )
}

export function isPlayerLinkHandoffSearch(search: string): boolean {
  return Boolean(linkTokenFromLocation(search)) && !lineOAuthCallbackCode(search)
}
