import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  linkTokenFromLocation,
  playerLinkBrowserUrl,
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
  const oauthStarted = useRef(false)

  const linkToken = linkTokenFromLocation(search)
  const hasOAuthCode = new URLSearchParams(search).has('code')
  const browserUrl = linkToken ? playerLinkBrowserUrl(linkToken) : null

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

      if (oauthStarted.current) return
      oauthStarted.current = true
      setPhase('oauth')
      startPlayerLinkOAuth(linkToken)
    })()

    return () => {
      active = false
    }
  }, [linkToken, hasOAuthCode])

  const openInBrowser = async () => {
    if (!browserUrl) return
    setError(null)
    const opened = await openLineExternalUrl(browserUrl)
    if (!opened) {
      setError('Tap the menu (⋯) → Open in browser, or copy the link below.')
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
          You&apos;re in LINE&apos;s browser. Open <strong className="text-brand-text">Safari</strong>{' '}
          to finish linking — do not sign in here.
        </p>
        <button
          type="button"
          onClick={() => void openInBrowser()}
          className="brand-btn w-full py-3 text-base font-semibold"
        >
          Open in browser
        </button>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="brand-btn-outline w-full py-2 text-sm font-semibold"
        >
          {copied ? 'Link copied!' : 'Copy link for Safari'}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
