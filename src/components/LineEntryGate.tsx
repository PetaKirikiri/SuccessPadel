import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
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
  const { t } = useTranslation()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!hasLiffId() || loading || user) {
      setWorking(false)
      return
    }
    if (shouldSkipLineEntryGate(pathname, search)) return
    if (!shouldTryLineInAppSignIn(false)) return

    let cancelled = false
    setWorking(true)
    setError(null)

    void runLineInAppSignIn(false).then((result) => {
      if (cancelled) return
      setWorking(false)
      if (result.skipped || result.redirected) return
      if (result.error) setError(result.error)
    })

    return () => {
      cancelled = true
    }
  }, [loading, user, pathname, search, attempt])

  useEffect(() => {
    if (!hasLiffId() || user) return
    const retry = () => {
      if (document.visibilityState !== 'visible') return
      if (!isLineLiffBrowser()) return
      setAttempt((n) => n + 1)
    }
    document.addEventListener('visibilitychange', retry)
    return () => document.removeEventListener('visibilitychange', retry)
  }, [user])

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
