import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
import { LineSigningInScreen } from './LineSigningInScreen'

/**
 * Guest scanned the organiser QR (LIFF URL with ?lpl=).
 * - Inside LINE: hand off to Safari — never log in inside LINE's browser.
 * - In Safari / default browser: LINE OAuth only.
 */
export function LinePlayerLinkEntryHandler() {
  const { search } = useLocation()
  const [phase, setPhase] = useState<'loading' | 'handoff' | 'oauth' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [opening, setOpening] = useState(false)
  const oauthStarted = useRef(false)

  const linkToken = linkTokenFromLocation(search)
  const competitionId = competitionIdFromPlayerLinkSearch(search)
  const hasOAuthCode = new URLSearchParams(search).has('code')
  const browserUrl = linkToken ? playerLinkBrowserUrl(linkToken, competitionId) : null

  useEffect(() => {
    if (!linkToken || hasOAuthCode) return

    let active = true

    void (async () => {
      try {
        await initLiff()
      } catch {
        /* external browser */
      }

      const inLine = isLineLiffBrowser() || isInLineClient() || (await detectInLineClient())
      if (!active) return

      if (inLine) {
        setPhase('handoff')
        return
      }

      if (linkToken && competitionId) {
        rememberPlayerLinkCompetition(linkToken, competitionId)
      }

      if (oauthStarted.current) return
      oauthStarted.current = true
      setPhase('oauth')
      startPlayerLinkOAuth(linkToken)
    })()

    return () => {
      active = false
    }
  }, [linkToken, hasOAuthCode, competitionId])

  const openInBrowser = async () => {
    if (!browserUrl) return
    setError(null)
    setOpening(true)
    const opened = await openLineExternalUrl(browserUrl)
    setOpening(false)
    if (!opened) {
      setError('Could not open Safari automatically. Use the link below or ⋯ → Open in browser.')
    }
  }

  const copyLink = async () => {
    if (!browserUrl) return
    try {
      await navigator.clipboard.writeText(browserUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link and open in Safari:', browserUrl)
    }
  }

  if (!linkToken || hasOAuthCode) return null

  if (phase === 'loading' || phase === 'oauth') {
    return (
      <div className="fixed inset-0 z-[100]">
        <LineSigningInScreen
          message={phase === 'oauth' ? 'Opening LINE in your browser…' : 'Checking…'}
        />
      </div>
    )
  }

  if (phase === 'error' || error) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-bg px-4">
        <div className="login-panel max-w-sm space-y-3 text-center">
          <p className="text-sm text-red-600">{error}</p>
          {browserUrl && (
            <a
              href={browserUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="brand-btn block w-full py-3 text-base font-semibold"
              onClick={(e) => {
                e.preventDefault()
                void openInBrowser()
              }}
            >
              Open in Safari
            </a>
          )}
          <p className="text-xs text-brand-muted">
            Ask the organiser to show the QR again from the leaderboard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="game-bg fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="login-panel w-full max-w-sm space-y-4 text-center">
        <p className="font-display text-lg font-semibold text-brand-primary">QR scanned</p>
        <p className="text-sm text-brand-muted">
          You&apos;re in LINE&apos;s browser. Tap below to open <strong className="text-brand-text">Safari</strong>{' '}
          and finish linking your account.
        </p>
        {browserUrl && (
          <a
            href={browserUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="brand-btn block w-full py-3 text-base font-semibold"
            onClick={(e) => {
              e.preventDefault()
              void openInBrowser()
            }}
          >
            {opening ? 'Opening Safari…' : 'Open in Safari'}
          </a>
        )}
        <button
          type="button"
          onClick={() => void copyLink()}
          className="brand-btn-outline w-full py-2 text-sm font-semibold"
        >
          {copied ? 'Link copied!' : 'Copy link (if Safari did not open)'}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
