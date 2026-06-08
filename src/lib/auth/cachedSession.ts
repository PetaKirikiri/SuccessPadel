import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

export const AUTH_STORAGE_KEY = 'success-padel-auth'

export function hasCachedAuthStorage(): boolean {
  try {
    return Boolean(localStorage.getItem(AUTH_STORAGE_KEY))
  } catch {
    return false
  }
}

/** True when this browser has logged in before (session may have expired). */
export function hadPreviousLogin(): boolean {
  return hasCachedAuthStorage()
}

/** Read persisted Supabase session from browser storage before showing a new-account QR. */
export async function tryRestoreCachedSession(): Promise<Session | null> {
  if (!hasCachedAuthStorage()) return null

  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user) return null

  const expiresAt = data.session.expires_at
  if (expiresAt && expiresAt * 1000 < Date.now()) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshed.session?.user) return null
    return refreshed.session
  }

  return data.session
}
