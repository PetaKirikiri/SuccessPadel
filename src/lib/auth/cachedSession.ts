import type { Session } from '@supabase/supabase-js'
import { readCachedProfile } from './cachedProfile'
import { AUTH_STORAGE_KEY, hasPersistedAuthRecord } from './authStorage'
import { supabase } from '../supabaseClient'

export { AUTH_STORAGE_KEY }

const BROWSER_SESSION_BACKUP_KEY = 'success-padel-browser-session'
const BACKUP_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90
const BACKUP_RESTORE_COOLDOWN_MS = 60_000

let restoreInFlight: Promise<Session | null> | null = null
let blockedBackupRefreshToken: string | null = null
let blockedBackupRestoreUntil = 0

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

/** User id from profile cache or session backup — survives navigation and refresh. */
export function readStoredAuthUserId(): string | null {
  const fromProfile = readCachedProfile()?.id
  if (fromProfile) return fromProfile
  return readBrowserSessionBackup()?.userId ?? null
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

function authErrorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

function blockBackupRestore(refreshToken: string, ms = BACKUP_RESTORE_COOLDOWN_MS): void {
  blockedBackupRefreshToken = refreshToken
  blockedBackupRestoreUntil = Date.now() + ms
}

function shouldSkipBackupRestore(backup: BrowserSessionBackup): boolean {
  return (
    blockedBackupRefreshToken === backup.refreshToken &&
    blockedBackupRestoreUntil > Date.now()
  )
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
  const backup = readBrowserSessionBackup()
  if (!backup) return null
  if (shouldSkipBackupRestore(backup)) return null

  const refreshed = await refreshWithToken(backup.refreshToken)
  if (refreshed.session) return refreshed.session

  if (refreshed.status === 400 || refreshed.status === 401) {
    clearBrowserSessionBackup()
    blockBackupRestore(backup.refreshToken, 5 * 60_000)
    return null
  }

  blockBackupRestore(backup.refreshToken)
  return null
}

async function refreshWithToken(refreshToken: string): Promise<{ session: Session | null; status: number | null }> {
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
    const session = data.session
    if (error || !session?.user) return { session: null, status: authErrorStatus(error) }
    rememberBrowserSession(session)
    return { session, status: null }
  } catch (error) {
    return { session: null, status: authErrorStatus(error) }
  }
}

async function restoreCachedSessionInternal(): Promise<Session | null> {
  if (hasCachedAuthStorage()) {
    const { data, error } = await supabase.auth.getSession()
    if (!error && data.session?.user) {
      if (sessionExpiresSoon(data.session)) {
        const refreshed = await refreshPersistedSession()
        if (refreshed) return refreshed
      }
      rememberBrowserSession(data.session)
      return data.session
    }
    const refreshed = await refreshPersistedSession()
    if (refreshed) return refreshed
  }

  return restoreBrowserSessionBackup()
}

/** Restore Supabase session from browser storage and refresh if needed. */
export async function tryRestoreCachedSession(): Promise<Session | null> {
  restoreInFlight ??= restoreCachedSessionInternal().finally(() => {
    restoreInFlight = null
  })
  return restoreInFlight
}

/** Restore a JWT the RPC layer will accept (re-hydrates the Supabase client if needed). */
export async function ensureWritableSession(): Promise<Session | null> {
  const { data: current } = await supabase.auth.getSession()
  if (current.session?.access_token) {
    if (sessionExpiresSoon(current.session)) {
      const refreshed = await refreshPersistedSession()
      if (refreshed?.access_token) return refreshed
    }
    rememberBrowserSession(current.session)
    return current.session
  }

  const restored = await tryRestoreCachedSession()
  if (!restored?.access_token) {
    return restoreBrowserSessionBackup()
  }

  const { data: afterRestore } = await supabase.auth.getSession()
  if (afterRestore.session?.access_token) {
    rememberBrowserSession(afterRestore.session)
    return afterRestore.session
  }

  const { error } = await supabase.auth.setSession({
    access_token: restored.access_token,
    refresh_token: restored.refresh_token,
  })
  if (error) {
    const fromBackup = await restoreBrowserSessionBackup()
    if (fromBackup?.access_token) return fromBackup
    return null
  }

  const { data: confirmed } = await supabase.auth.getSession()
  if (!confirmed.session?.access_token) return null
  rememberBrowserSession(confirmed.session)
  return confirmed.session
}

/** Keep access token fresh while the app is open. */
export async function keepSessionAlive(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session?.user) return tryRestoreCachedSession()
  if (sessionExpiresSoon(session, 5 * 60_000)) {
    return (await refreshPersistedSession()) ?? session
  }
  rememberBrowserSession(session)
  return session
}
