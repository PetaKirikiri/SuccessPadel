import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { runLineInAppConnect } from '../lib/line/lineInAppConnect'
import { lineOAuthCallbackCode } from '../lib/line/oauth'
import { hasLiffId } from '../lib/line/liff'

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
  const started = useRef(false)
  const [working, setWorking] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasLiffId()) return
    if (loading) return
    if (shouldSkipLineEntryGate(pathname, search)) return
    if (started.current) return

    started.current = true
    setWorking(true)
    setLinking(pathname.startsWith('/players/'))

    void runLineInAppConnect(pathname, search, Boolean(user)).then((result) => {
      if (result.redirected) return
      setWorking(false)
      if (result.error) {
        setError(result.error)
        return
      }
      setError(null)
    })
  }, [loading, user, pathname, search])

  const statusLabel = linking ? t('lineLink.linkingAccount') : t('lineLink.signingInLine')

  return (
    <>
      {working ? (
        <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center bg-white/80 px-6">
          <p className="text-center text-sm text-brand-muted">{statusLabel}</p>
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
