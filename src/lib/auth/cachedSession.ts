import type { Session } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, hasPersistedAuthRecord } from './authStorage'
import { supabase } from '../supabaseClient'

export { AUTH_STORAGE_KEY }

const BROWSER_SESSION_BACKUP_KEY = 'success-padel-browser-session'
const BACKUP_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90

type BrowserSessionBackup = {
  savedAt: number
  accessToken: string
  refreshToken: string
  expiresAt: number | null
  userId: string
}

export function hasCachedAuthStorage(): boolean {
  return hasPersistedAuthRecord()
}

/** True when this browser has logged in before (session may have expired). */
export function hadPreviousLogin(): boolean {
  return hasCachedAuthStorage() || Boolean(readBrowserSessionBackup())
}

function isLineContext(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  const qs = `${window.location.search}${window.location.hash}`
  return (
    /\bLine\//i.test(ua) ||
    document.referrer.includes('liff.line.me') ||
    qs.includes('liff.state') ||
    qs.includes('liff.auth') ||
    qs.includes('liffClientId') ||
    qs.includes('liff.referrer')
  )
}

function readBrowserSessionBackup(): BrowserSessionBackup | null {
  try {
    const raw = localStorage.getItem(BROWSER_SESSION_BACKUP_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BrowserSessionBackup>
    if (
      typeof parsed.savedAt !== 'number' ||
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.userId !== 'string'
    ) {
      return null
    }
    if (Date.now() - parsed.savedAt > BACKUP_MAX_AGE_MS) {
      localStorage.removeItem(BROWSER_SESSION_BACKUP_KEY)
      return null
    }
    return {
      savedAt: parsed.savedAt,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null,
      userId: parsed.userId,
    }
  } catch {
    return null
  }
}

export function rememberBrowserSession(session: Session | null): void {
  if (!session?.user || !session.access_token || !session.refresh_token) return
  try {
    const backup: BrowserSessionBackup = {
      savedAt: Date.now(),
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? null,
      userId: session.user.id,
    }
    localStorage.setItem(BROWSER_SESSION_BACKUP_KEY, JSON.stringify(backup))
  } catch {
    /* Safari private mode / storage full */
  }
}

export function clearBrowserSessionBackup(): void {
  try {
    localStorage.removeItem(BROWSER_SESSION_BACKUP_KEY)
  } catch {
    /* ignore */
  }
}

function sessionExpiresSoon(session: Session, skewMs = 60_000): boolean {
  const expiresAt = session.expires_at
  if (!expiresAt) return false
  return expiresAt * 1000 < Date.now() + skewMs
}

async function refreshPersistedSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session?.user) return null
  rememberBrowserSession(data.session)
  return data.session
}

async function restoreBrowserSessionBackup(): Promise<Session | null> {
  if (isLineContext()) return null
  const backup = readBrowserSessionBackup()
  if (!backup) return null

  const refreshed = await refreshWithToken(backup.refreshToken)
  if (refreshed) return refreshed

  const { error } = await supabase.auth.setSession({
    access_token: backup.accessToken,
    refresh_token: backup.refreshToken,
  })
  if (error) return null
  const { data } = await supabase.auth.refreshSession()
  const session = data.session
  if (!session?.user) return null
  rememberBrowserSession(session)
  return session
}

async function refreshWithToken(refreshToken: string): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
    const session = data.session
    if (error || !session?.user) return null
    rememberBrowserSession(session)
    return session
  } catch {
    return null
  }
}

/** Restore Supabase session from browser storage and refresh if needed. */
export async function tryRestoreCachedSession(): Promise<Session | null> {
  if (!hasCachedAuthStorage()) return restoreBrowserSessionBackup()

  const { data, error } = await supabase.auth.getSession()
  if (error) return (await refreshPersistedSession()) ?? restoreBrowserSessionBackup()

  const session = data.session
  if (!session?.user) return (await refreshPersistedSession()) ?? restoreBrowserSessionBackup()
  if (sessionExpiresSoon(session)) {
    const refreshed = await refreshPersistedSession()
    return refreshed ?? session
  }

  rememberBrowserSession(session)
  return session
}
