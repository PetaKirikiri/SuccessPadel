import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { ensureWritableSession, hadPreviousLogin, readStoredAuthUserId } from '../lib/auth/cachedSession'
import { saveReturnTo } from '../lib/authReturnTo'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, profile, loading, restoreSession } = useAuth()
  const { t } = useTranslation()
  const loc = useLocation()
  const hasWritableSession = Boolean(session?.user)
  const hasIdentity = Boolean(hasWritableSession || user || profile)
  const mayHaveStoredLogin = hadPreviousLogin() || Boolean(readStoredAuthUserId())
  const [restoring, setRestoring] = useState(
    () => !hasWritableSession && (mayHaveStoredLogin || Boolean(user || profile)),
  )

  useEffect(() => {
    if (hasWritableSession || loading) {
      setRestoring(false)
      return
    }
    if (!mayHaveStoredLogin && !user && !profile) {
      setRestoring(false)
      return
    }

    let active = true
    setRestoring(true)
    void (async () => {
      const live = await restoreSession()
      if (!active) return
      if (!live) await ensureWritableSession()
      if (active) setRestoring(false)
    })()
    return () => {
      active = false
    }
  }, [hasWritableSession, loading, mayHaveStoredLogin, user, profile, loc.pathname, restoreSession])

  if (loading || restoring) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">{t('common.loading')}</p>
      </div>
    )
  }

  if (!hasIdentity) {
    saveReturnTo(`${loc.pathname}${loc.search}`)
    return <Navigate to="/friendly" replace />
  }

  return children
}
