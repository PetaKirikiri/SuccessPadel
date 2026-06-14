import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { consumeReturnTo } from '../lib/authReturnTo'
import { lineHandshakeDebug } from '../lib/debug/lineHandshakeDebug'
import { signInWithLine } from '../lib/line/auth'
import {
  runLineInAppSignIn,
  shouldTryLineInAppSignIn,
} from '../lib/line/lineInAppConnect'
import { lineOAuthCallbackCode } from '../lib/line/oauth'
import { hasLiffId, isLineLiffBrowser } from '../lib/line/liff'

function shouldSkipLineEntryGate(pathname: string, search: string): boolean {
  if (pathname.startsWith('/auth/')) return true
  if (pathname === '/login' && lineOAuthCallbackCode(search)) return true
  return false
}

/** Prompt LINE Allow + sign-in when opened inside the LINE app. */
export function LineEntryGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const signInStarted = useRef(false)

  useEffect(() => {
    // #region agent log
    lineHandshakeDebug('S1-gate', 'LineEntryGate.tsx:effect', 'gate effect tick', 'H1', {
      loading,
      hasUser: Boolean(user),
      hasLiffId: hasLiffId(),
      isLineBrowser: isLineLiffBrowser(),
      pathname,
      attempt,
      skipAuth: shouldSkipLineEntryGate(pathname, search),
      shouldTry: shouldTryLineInAppSignIn(Boolean(user)),
    })
    // #endregion

    if (!hasLiffId() || loading || user) {
      setWorking(false)
      return
    }
    if (shouldSkipLineEntryGate(pathname, search)) return
    if (!shouldTryLineInAppSignIn(false)) return

    let cancelled = false
    setWorking(true)
    setError(null)

    // #region agent log
    lineHandshakeDebug('S1-gate', 'LineEntryGate.tsx:run', 'starting runLineInAppSignIn', 'H1', {
      attempt,
    })
    // #endregion

    void runLineInAppSignIn(false).then((result) => {
      if (cancelled) return
      // #region agent log
      lineHandshakeDebug('S1-gate', 'LineEntryGate.tsx:result', 'runLineInAppSignIn finished', 'H1', {
        ok: result.ok,
        skipped: result.skipped,
        redirected: result.redirected,
        error: result.error,
      })
      // #endregion
      setWorking(false)
      if (result.skipped || result.redirected) return
      if (result.error) setError(result.error)
    })

    return () => {
      cancelled = true
    }
  }, [loading, user, pathname, search, attempt])

  useEffect(() => {
    if (loading || user) return
    if (pathname !== '/login' || !isLineLiffBrowser()) return
    if (!lineOAuthCallbackCode(search)) return
    if (signInStarted.current) return
    signInStarted.current = true

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
    })
  }, [loading, user, pathname, search, navigate])

  useEffect(() => {
    if (!hasLiffId() || user) return
    const retry = () => {
      if (document.visibilityState !== 'visible') return
      if (!isLineLiffBrowser()) return
      // #region agent log
      lineHandshakeDebug('S1-gate', 'LineEntryGate.tsx:retry', 'visibility retry', 'H3', {})
      // #endregion
      setAttempt((n) => n + 1)
    }
    document.addEventListener('visibilitychange', retry)
    return () => document.removeEventListener('visibilitychange', retry)
  }, [user])

  useEffect(() => {
    // #region agent log
    lineHandshakeDebug('S8-ui', 'LineEntryGate.tsx:auth', 'auth state for sign-in chip', 'H5', {
      loading,
      hasUser: Boolean(user),
      userIdPrefix: user?.id?.slice(0, 8) ?? null,
    })
    // #endregion
  }, [loading, user])

  return (
    <>
      {working ? (
        <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center bg-white/80 px-6">
          <p className="text-center text-sm text-brand-muted">{t('lineLink.signingInLine')}</p>
        </div>
      ) : null}
      {error ? (
        <div className="fixed inset-x-0 top-14 z-[301] mx-auto max-w-sm rounded-lg border border-red-200 bg-white px-3 py-2 shadow-md">
          <p className="text-center text-xs text-red-600">{error}</p>
        </div>
      ) : null}
      {children}
    </>
  )
}
