import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { consumeReturnTo, peekReturnTo } from '../../lib/authReturnTo'
import { lineHandshakeDebug } from '../../lib/debug/lineHandshakeDebug'
import { signInWithLine } from '../../lib/line/auth'
import {
  isPlayerProfilePath,
  runLinePlayerProfileHandshake,
} from '../../lib/line/profileHandshake'
import { resolvePlayerProfile } from '../../lib/playerProfile'
import {
  runLineInAppSignIn,
  shouldTryLineInAppSignIn,
} from '../../lib/line/lineInAppConnect'
import { lineOAuthCallbackCode } from '../../lib/line/oauth'
import { isInLineClient, isLineLiffBrowser, lineSignInEntryUrl } from '../../lib/line/liff'
import { passiveLineEntryPath } from '../../lib/line/passiveRecognition'
import { canonicalResumeUrl, carriedReturnPath, LINE_RESUME_PATH } from '../../lib/line/returnDestination'
import { PLAYER_LINK_APP_ORIGIN } from '../../lib/line/playerLinkReturnUrls'
import { finishLineReturn, prepareLineReturn } from '../../lib/line/returnHandoff'
import { LineSigningInScreen } from './LineSigningInScreen'

function shouldSkipLineEntryGate(pathname: string, search: string): boolean {
  if (pathname.startsWith('/auth/')) return true
  if (pathname === '/login' && lineOAuthCallbackCode(search)) return true
  if (/^\/players\/[0-9a-f-]{36}$/i.test(pathname)) return true
  return false
}

function hasExplicitLiffContext(search: string): boolean {
  const qs = `${search}${window.location.hash}`
  return (
    qs.includes('liff.state') ||
    qs.includes('liff.auth') ||
    qs.includes('liffClientId') ||
    qs.includes('liff.referrer') ||
    document.referrer.includes('liff.line.me')
  )
}

/** Recognise existing LINE members without blocking public competition access. */
export function LineEntryGate({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const signInStarted = useRef(false)
  const destination = carriedReturnPath(window.location.href)
  const isResume = pathname === LINE_RESUME_PATH
  const resumeTicket = useRef(new URLSearchParams(window.location.hash.slice(1)).get('ticket'))

  useEffect(() => {
    if (!destination && !isResume) return
    let active = true
    if (isResume) {
      if (window.location.origin !== PLAYER_LINK_APP_ORIGIN) {
        window.location.replace(canonicalResumeUrl(destination ?? '/friendly', resumeTicket.current ?? undefined))
        return
      }
      // Clear the one-use credential before rendering children or navigating.
      window.history.replaceState(window.history.state, '', `${pathname}${search}`)
      const target = new URL(destination ?? '/friendly', window.location.origin)
      target.searchParams.set('sp_line_attempt', '1')
      const leave = () => {
        if (active) window.location.replace(`${target.pathname}${target.search}${target.hash}`)
      }
      const timer = window.setTimeout(leave, 12_000)
      void finishLineReturn(resumeTicket.current).catch(() => {}).finally(() => {
        window.clearTimeout(timer)
        leave()
      })
      return () => { active = false; window.clearTimeout(timer) }
    }
    // This also intercepts the legacy /login endpoint before its fallback route
    // can discard the query. The destination survives across browser origins.
    void prepareLineReturn(destination!).then(url => {
      if (active) window.location.replace(url)
    })
    return () => { active = false }
  }, [destination, isResume, pathname, search])

  const recognitionAllowed = useRef(false)
  useEffect(() => {
    recognitionAllowed.current = !destination && !isResume && !loading && !user && !profile && !shouldSkipLineEntryGate(pathname, search)
    if (!recognitionAllowed.current || !shouldTryLineInAppSignIn(false)) return

    // An ordinary LINE webview may need one LIFF handoff. The URL marker
    // survives origin changes; storage blocks repeat handoffs after navigation.
    if (!isInLineClient() && !hasExplicitLiffContext(search)) {
      let entryPath: string | null = null
      try {
        entryPath = passiveLineEntryPath(window.location.href, window.sessionStorage)
      } catch {
        // Private/restricted storage: stay on the usable guest page.
      }
      const entry = entryPath ? lineSignInEntryUrl(entryPath) : null
      if (entry) {
        window.location.replace(entry)
        return
      }
    }
    // No overlay, signup, forced login, visibility retry or automatic error toast.
    void runLineInAppSignIn(() => recognitionAllowed.current)
    return () => { recognitionAllowed.current = false }
  }, [loading, user, profile, pathname, search, destination, isResume])

  useEffect(() => {
    if (destination || isResume) return
    if (loading || user || profile) return
    if (pathname !== '/login' || !isLineLiffBrowser()) return
    if (!lineOAuthCallbackCode(search)) return
    if (signInStarted.current) return
    signInStarted.current = true

    const returnTo = peekReturnTo('/friendly')
    const returnPath = returnTo.split('?')[0]

    if (isPlayerProfilePath(returnPath)) {
      // #region agent log
      lineHandshakeDebug(
        'S9-profile',
        'LineEntryGate.tsx:login-callback',
        'LIFF /login → profile handshake',
        'H9',
        { returnPath },
      )
      // #endregion

      const routePlayerId = returnPath.split('/').pop() ?? ''
      void (async () => {
        const resolved = await resolvePlayerProfile(routePlayerId)
        const padelId =
          resolved.linkablePadelPlayerId ?? resolved.padelPlayerId ?? routePlayerId
        const result = await runLinePlayerProfileHandshake(padelId)
        signInStarted.current = false
        if (result.error) {
          setError(result.error)
          return
        }
        navigate(consumeReturnTo('/friendly'), { replace: true })
      })().catch(() => { setError('LINE sign-in could not finish. Please try again.') })
      return
    }

    // #region agent log
    lineHandshakeDebug('S5-auth', 'LineEntryGate.tsx:login-callback', 'LIFF /login callback sign-in', 'H7', {})
    // #endregion

    void signInWithLine().then(({ error }) => {
      signInStarted.current = false
      if (error) {
        setError(error)
        return
      }
      navigate(consumeReturnTo('/friendly'), { replace: true })
    }).catch(() => { setError('LINE sign-in could not finish. Please try again.') })
  }, [loading, user, profile, pathname, search, navigate, destination, isResume])

  useEffect(() => {
    // #region agent log
    lineHandshakeDebug('S8-ui', 'LineEntryGate.tsx:auth', 'auth state for sign-in chip', 'H5', {
      loading,
      hasUser: Boolean(user),
      userIdPrefix: user?.id?.slice(0, 8) ?? null,
    })
    // #endregion
  }, [loading, user])

  if (destination || isResume) return <LineSigningInScreen message="Opening your competition…" />

  return (
    <>
      {error ? (
        <div className="fixed inset-x-0 top-14 z-[301] mx-auto max-w-sm rounded-lg border border-red-200 bg-white px-3 py-2 shadow-md">
          <p className="text-center text-xs text-red-600">{error}</p>
        </div>
      ) : null}
      {children}
    </>
  )
}
