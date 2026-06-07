import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { scheduleForceExternalOpen } from '../lib/line/forceExternalBrowser'
import { lineOAuthCallbackCode } from '../lib/line/oauth'
import {
  completeLinePlayerLinkInLiff,
  competitionIdFromPlayerLinkSearch,
  linkTokenFromLocation,
  playerLinkScoreboardHandoffUrl,
  rememberPlayerLinkCompetition,
  startPlayerLinkOAuth,
} from '../lib/line/playerLink'
import { detectInLineClient, initLiff, isLineLiffBrowser } from '../lib/line/liff'

type Phase = 'working' | 'success' | 'error'

/**
 * QR in LINE app only.
 * 1. LINE Allow prompt (no Success Padel login page)
 * 2. Link guest → Supabase in the background
 * 3. Success screen, then force-open scoreboard in phone browser
 */
export function LinePlayerLinkEntryHandler() {
  const { t } = useTranslation()
  const { search } = useLocation()
  const oauthStarted = useRef(false)
  const linking = useRef(false)
  const [phase, setPhase] = useState<Phase>('working')
  const [error, setError] = useState<string | null>(null)

  const linkToken = linkTokenFromLocation(search)
  const competitionId = competitionIdFromPlayerLinkSearch(search)
  const hasOAuthCode = Boolean(lineOAuthCallbackCode(search))

  useEffect(() => {
    if (!linkToken || hasOAuthCode) return

    let active = true
    let stopOpen: (() => void) | undefined

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

        const { handoffToken, redirected, error: linkErr } =
          await completeLinePlayerLinkInLiff(linkToken)
        if (!active) return
        if (redirected) return
        if (linkErr || !handoffToken) {
          setError(linkErr ?? t('lineLink.linkingFailed'))
          setPhase('error')
          linking.current = false
          return
        }

        setPhase('success')
        const scoreboardUrl = playerLinkScoreboardHandoffUrl(handoffToken)
        stopOpen = scheduleForceExternalOpen(scoreboardUrl)
        return
      }

      if (oauthStarted.current) return
      oauthStarted.current = true
      startPlayerLinkOAuth(linkToken)
    })()

    return () => {
      active = false
      stopOpen?.()
    }
  }, [linkToken, hasOAuthCode, competitionId])

  if (!linkToken || hasOAuthCode) return null

  if (phase === 'error') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white px-6">
        <p className="text-center text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (phase === 'success') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-white px-6">
        <p className="font-display text-lg font-semibold text-[#06C755]">{t('lineLink.linkSuccess')}</p>
        <p className="text-center text-sm text-neutral-500">{t('lineLink.openingScoreboard')}</p>
        <p className="text-center text-xs text-neutral-400">{t('lineLink.tapIfNotOpen')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-white px-6">
      <p className="text-center text-sm text-neutral-400">{t('lineLink.oneMoment')}</p>
    </div>
  )
}

export function isPlayerLinkHandoffSearch(search: string): boolean {
  return Boolean(linkTokenFromLocation(search)) && !lineOAuthCallbackCode(search)
}
