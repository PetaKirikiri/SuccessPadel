import { supabase } from '../supabaseClient'
import { isLocalDebugIngestEnabled, postLocalDebugIngest } from './localIngest'
const SESSION = '8bc41b'
const STORAGE_KEY = 'debug-8bc41b'
const DEBUG_MODE_KEY = 'login-debug-mode'
const MAX_LOCAL = 100

export type LoginDebugEntry = {
  sessionId: string
  seq: number
  location: string
  message: string
  hypothesisId: string
  data: Record<string, unknown>
  timestamp: number
  pageUrl: string
  userAgent: string
}

let remoteQueue: LoginDebugEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

export function isLoginDebugMode(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      localStorage.setItem(DEBUG_MODE_KEY, '1')
      return true
    }
    return localStorage.getItem(DEBUG_MODE_KEY) === '1'
  } catch {
    return new URLSearchParams(window.location.search).get('debug') === '1'
  }
}

export function loginWithAppUrlSnapshot() {
  const u = new URL(window.location.href)
  const hashKeys = u.hash
    .replace(/^#/, '')
    .split('&')
    .map((p) => p.split('=')[0])
    .filter(Boolean)
  const searchKeys = [...u.searchParams.keys()]
  return {
    host: u.host,
    pathname: u.pathname,
    searchKeys,
    hashKeys,
    oauthError: u.searchParams.get('error'),
    oauthErrorDesc: u.searchParams.get('error_description')?.slice(0, 80) ?? null,
    hasLiffState: u.search.includes('liff.state') || u.hash.includes('liff.state'),
    hasAccessToken: u.hash.includes('access_token'),
    visibility: typeof document !== 'undefined' ? document.visibilityState : null,
    referrer: typeof document !== 'undefined' ? document.referrer.slice(0, 120) : null,
  }
}

function nextSeq(): number {
  try {
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as LoginDebugEntry[]
    return (prev.at(-1)?.seq ?? 0) + 1
  } catch {
    return 1
  }
}

function persistLocal(entry: LoginDebugEntry) {
  try {
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as LoginDebugEntry[]
    prev.push(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(-MAX_LOCAL)))
  } catch {
    /* ignore */
  }
}

export function flushLoginDebugRemote(sync = false): void {
  if (!remoteQueue.length) return
  const batch = remoteQueue.splice(0, remoteQueue.length)

  const send = () => {
    if (isLoginDebugMode()) {
      void supabase.functions.invoke('login-debug-log', { body: { events: batch } }).catch(() => {})
    }
    if (isLocalDebugIngestEnabled()) {
      postLocalDebugIngest(batch.length === 1 ? batch[0] : { events: batch }, SESSION)
    }
  }

  if (sync && typeof fetch !== 'undefined') {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (url && key) {
      fetch(`${url}/functions/v1/login-debug-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      }).catch(() => {})
    }
    send()
    return
  }

  send()
}

function scheduleRemoteFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushLoginDebugRemote()
  }, 800)
}

export function loginWithAppDebugLog(
  location: string,
  message: string,
  hypothesisId: string,
  data: Record<string, unknown> = {},
) {
  const entry: LoginDebugEntry = {
    sessionId: SESSION,
    seq: nextSeq(),
    location,
    message,
    hypothesisId,
    data: {
      ...data,
      url: loginWithAppUrlSnapshot(),
    },
    timestamp: Date.now(),
    pageUrl: window.location.href.slice(0, 500),
    userAgent: navigator.userAgent.slice(0, 300),
  }
  // #region agent log
  persistLocal(entry)
  remoteQueue.push(entry)
  scheduleRemoteFlush()
  if (isLoginDebugMode()) {
    window.dispatchEvent(new CustomEvent('login-debug-log', { detail: entry }))
  }
  // #endregion
}

export function readLoginWithAppDebugLog(): LoginDebugEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as LoginDebugEntry[]
  } catch {
    return []
  }
}

export function clearLoginWithAppDebugLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function installLoginWithAppLifecycleDebug(): void {
  if (!isLoginDebugMode() && !isLocalDebugIngestEnabled()) return

  const snap = () => ({
    visibility: document.visibilityState,
    hidden: document.hidden,
    referrer: document.referrer.slice(0, 120),
    href: window.location.href.slice(0, 200),
  })

  loginWithAppDebugLog('lifecycle:bootstrap', 'app boot', 'H20', {
    ...snap(),
    debugMode: isLoginDebugMode(),
    platform: /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? 'ios'
      : /Android/i.test(navigator.userAgent)
        ? 'android'
        : 'other',
  })

  window.addEventListener('pageshow', (e) => {
    loginWithAppDebugLog('lifecycle:pageshow', 'pageshow', 'H20', {
      persisted: e.persisted,
      ...snap(),
    })
  })

  window.addEventListener('pagehide', (e) => {
    loginWithAppDebugLog('lifecycle:pagehide', 'pagehide', 'H20', {
      persisted: e.persisted,
      ...snap(),
    })
    flushLoginDebugRemote(true)
  })

  document.addEventListener('visibilitychange', () => {
    loginWithAppDebugLog('lifecycle:visibility', 'visibilitychange', 'H21', snap())
  })

  window.addEventListener('focus', () => {
    loginWithAppDebugLog('lifecycle:focus', 'window focus', 'H21', snap())
  })

  window.addEventListener('blur', () => {
    loginWithAppDebugLog('lifecycle:blur', 'window blur', 'H21', snap())
  })

  window.addEventListener('beforeunload', () => {
    loginWithAppDebugLog('lifecycle:beforeunload', 'beforeunload', 'H21', snap())
    flushLoginDebugRemote(true)
  })
}

export function liffIdFingerprint(): string {
  const id = import.meta.env.VITE_LIFF_ID as string | undefined
  if (!id) return 'MISSING'
  return `${id.slice(0, 12)}…len${id.length}`
}
