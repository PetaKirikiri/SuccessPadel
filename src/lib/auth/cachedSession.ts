import type { Session } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, hasPersistedAuthRecord } from './authStorage'
import { supabase } from '../supabaseClient'

export { AUTH_STORAGE_KEY }

export function hasCachedAuthStorage(): boolean {
  return hasPersistedAuthRecord()
}

/** True when this browser has logged in before (session may have expired). */
export function hadPreviousLogin(): boolean {
  return hasCachedAuthStorage()
}

function sessionExpiresSoon(session: Session, skewMs = 60_000): boolean {
  const expiresAt = session.expires_at
  if (!expiresAt) return false
  return expiresAt * 1000 < Date.now() + skewMs
}

async function refreshPersistedSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session?.user) return null
  return data.session
}

/** Restore Supabase session from browser storage and refresh if needed. */
export async function tryRestoreCachedSession(): Promise<Session | null> {
  if (!hasCachedAuthStorage()) return null

  const { data, error } = await supabase.auth.getSession()
  if (error) return refreshPersistedSession()

  const session = data.session
  if (!session?.user) return refreshPersistedSession()
  if (sessionExpiresSoon(session)) {
    const refreshed = await refreshPersistedSession()
    return refreshed ?? session
  }

  return session
}
