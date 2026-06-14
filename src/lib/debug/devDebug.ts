const DEBUG_MODE_KEY = 'sp-dev-debug'
const INGEST_PATH = '/api/debug/ingest'

export type DevDebugEntry = {
  ts: number
  sessionId: string
  channel: string
  message: string
  data?: Record<string, unknown>
  pageUrl: string
  userAgent: string
}

function isDevServerHost(): boolean {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return true
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true
  return false
}

/** Opt-in via ?debug=1 (sticky) or VITE_DEV_DEBUG=1 in .env.local */
export function isDevDebugMode(): boolean {
  if (!import.meta.env.DEV) return false
  if (import.meta.env.VITE_DEV_DEBUG === '1') return true
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

/** DEV + LAN/localhost Vite server + debug mode. Works from phone → your Mac via IP. */
export function isLocalDebugIngestEnabled(): boolean {
  return import.meta.env.DEV && isDevServerHost() && isDevDebugMode()
}

export function devDebugLog(
  channel: string,
  message: string,
  data?: Record<string, unknown>,
  sessionId = 'sp-dev',
): void {
  if (!isLocalDebugIngestEnabled()) return
  postLocalDebugIngest(
    {
      ts: Date.now(),
      channel,
      message,
      ...(data ? { data } : {}),
      pageUrl: window.location.pathname + window.location.search,
      userAgent: navigator.userAgent.slice(0, 160),
    },
    sessionId,
  )
}

/** POST debug payload to the Vite dev server on this machine (same host:port as the app). */
export function postLocalDebugIngest(payload: unknown, sessionId = 'sp-dev'): void {
  if (typeof window === 'undefined') return
  if (!import.meta.env.DEV || !isDevServerHost()) return
  fetch(INGEST_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': sessionId,
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}

const AGENT_DEBUG_ENDPOINT =
  'http://127.0.0.1:7695/ingest/c4960c9b-f3c9-4190-b564-b1526039f3c6'

/** Debug mode: dual-write to Cursor ingest + Vite LAN ingest (phone → Mac). */
export function agentDebugIngest(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  sessionId = 'ce1aed',
): void {
  if (!import.meta.env.DEV) return
  const payload = {
    sessionId,
    location,
    message,
    hypothesisId,
    data,
    timestamp: Date.now(),
    pageUrl: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
  }
  debugSessionLog(location, message, data, hypothesisId, sessionId)
  if (typeof window !== 'undefined') {
    fetch(AGENT_DEBUG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': sessionId,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  }
}

/** Cursor debug session — DEV + LAN host, no ?debug=1 required. Phone → Mac via dev IP. */
export function debugSessionLog(
  location: string,
  message: string,
  data?: Record<string, unknown>,
  hypothesisId?: string,
  sessionId = 'ce1aed',
): void {
  if (!import.meta.env.DEV || !isDevServerHost()) return
  postLocalDebugIngest(
    {
      sessionId,
      location,
      message,
      hypothesisId,
      data,
      timestamp: Date.now(),
      pageUrl: window.location.pathname + window.location.search,
    },
    sessionId,
  )
}
