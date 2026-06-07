import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { lineOAuthCallbackCode } from '../lib/line/oauth'
import {
  competitionIdFromPlayerLinkSearch,
  linkTokenFromLocation,
  playerLinkBrowserUrl,
  rememberPlayerLinkCompetition,
  startPlayerLinkOAuth,
} from '../lib/line/playerLink'
import {
  detectInLineClient,
  initLiff,
  isInLineClient,
  isLineLiffBrowser,
  openLineExternalUrl,
} from '../lib/line/liff'

/** Bare redirect page — handshake link only, no app chrome. */
export function LinePlayerLinkEntryHandler() {
  const { search } = useLocation()
  const opened = useRef(false)
  const oauthStarted = useRef(false)

  const linkToken = linkTokenFromLocation(search)
  const competitionId = competitionIdFromPlayerLinkSearch(search)
  const hasOAuthCode = Boolean(lineOAuthCallbackCode(search))
  const browserUrl = linkToken ? playerLinkBrowserUrl(linkToken, competitionId) : null

  useEffect(() => {
    if (!linkToken || hasOAuthCode || !browserUrl) return

    let active = true

    void (async () => {
      const inLineWebview = isLineLiffBrowser()

      if (inLineWebview) {
        try {
          await initLiff()
        } catch {
          /* show link only */
        }
      }

      const inLineClient = inLineWebview && isInLineClient()
      const inLine = inLineClient || (inLineWebview && (await detectInLineClient()))
      if (!active) return

      if (linkToken && competitionId) {
        rememberPlayerLinkCompetition(linkToken, competitionId)
      }

      if (inLine) {
        if (!opened.current) {
          opened.current = true
          await openLineExternalUrl(browserUrl)
        }
        return
      }

      if (oauthStarted.current) return
      oauthStarted.current = true
      startPlayerLinkOAuth(linkToken)
    })()

    return () => {
      active = false
    }
  }, [linkToken, hasOAuthCode, browserUrl, competitionId])

  if (!linkToken || hasOAuthCode || !browserUrl) return null

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-white p-4">
      <a
        href={browserUrl}
        className="break-all text-center text-sm text-[#06C755] underline"
        onClick={(e) => {
          e.preventDefault()
          void openLineExternalUrl(browserUrl)
        }}
      >
        {browserUrl}
      </a>
    </div>
  )
}

export function isPlayerLinkHandoffSearch(search: string): boolean {
  return Boolean(linkTokenFromLocation(search)) && !lineOAuthCallbackCode(search)
}
