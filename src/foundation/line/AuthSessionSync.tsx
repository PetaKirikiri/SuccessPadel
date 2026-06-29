import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { hadPreviousLogin } from '../../lib/auth/cachedSession'

/** Re-attach Supabase session on every in-app navigation (single shell, same auth root). */
export function AuthSessionSync() {
  const { pathname } = useLocation()
  const { session, user, restoreSession } = useAuth()

  useEffect(() => {
    if (session?.user) return
    if (!user && !hadPreviousLogin()) return
    void restoreSession()
  }, [pathname, session, user, restoreSession])

  return null
}
