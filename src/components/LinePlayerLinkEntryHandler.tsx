import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { scheduleForceExternalOpen } from '../lib/line/forceExternalBrowser'
import { lineOAuthCallbackCode } from '../lib/line/oauth'
import {
  competitionIdFromPlayerLinkSearch,
  linkTokenFromLocation,
  playerLinkBrowserUrl,
  rememberPlayerLinkCompetition,
  startPlayerLinkOAuth,
} from '../lib/line/playerLink'
import { isLineLiffBrowser, detectInLineClient } from '../lib/line/liff'

/** Bare redirect page — forces system browser, no app chrome, no hyperlinks. */
export function LinePlayerLinkEntryHandler() {
  const { search } = useLocation()
  const oauthStarted = useRef(false)
  const [status, setStatus] = useState<'opening' | 'retry'>('opening')

  const linkToken = linkTokenFromLocation(search)
  const competitionId = competitionIdFromPlayerLinkSearch(search)
  const hasOAuthCode = Boolean(lineOAuthCallbackCode(search))
  const browserUrl = linkToken ? playerLinkBrowserUrl(linkToken, competitionId) : null

  useEffect(() => {
    if (!linkToken || hasOAuthCode || !browserUrl) return

    let active = true
    let stopSchedule: (() => void) | undefined

    void (async () => {
      if (linkToken && competitionId) {
        rememberPlayerLinkCompetition(linkToken, competitionId)
      }

      const inLine = isLineLiffBrowser() || (await detectInLineClient())
      if (!active) return

      if (inLine) {
        stopSchedule = scheduleForceExternalOpen(browserUrl, () => {
          if (active) setStatus('retry')
        })
        return
      }

      if (oauthStarted.current) return
      oauthStarted.current = true
      startPlayerLinkOAuth(linkToken)
    })()

    return () => {
      active = false
      stopSchedule?.()
    }
  }, [linkToken, hasOAuthCode, browserUrl, competitionId])

  if (!linkToken || hasOAuthCode || !browserUrl) return null

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-white px-6">
      <p className="text-center text-sm text-neutral-500">
        {status === 'retry' ? 'Opening your browser… tap anywhere on this screen' : 'Opening Safari…'}
      </p>
    </div>
  )
}

export function isPlayerLinkHandoffSearch(search: string): boolean {
  return Boolean(linkTokenFromLocation(search)) && !lineOAuthCallbackCode(search)
}
