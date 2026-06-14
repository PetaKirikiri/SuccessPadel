import { flushLoginDebugRemote, isLoginDebugMode, loginWithAppDebugLog } from './loginWithAppDebug'
import { postLocalDebugIngest } from './localIngest'
import { supabase } from '../supabaseClient'
import { isLineLiffBrowser } from '../line/liff'

export const LINE_HANDSHAKE_SESSION = 'd2fcaa'
const CURSOR_ENDPOINT =
  'http://127.0.0.1:7695/ingest/c4960c9b-f3c9-4190-b564-b1526039f3c6'

let seq = 0

/** Stage ping for LINE LIFF handshake — Cursor ingest, Vite LAN, Supabase (debug=1). */
export function lineHandshakeDebug(
  stage: string,
  location: string,
  message: string,
  hypothesisId: string,
  data: Record<string, unknown> = {},
) {
  seq += 1
  const payload = {
    sessionId: LINE_HANDSHAKE_SESSION,
    runId: 'line-handshake',
    stage,
    location,
    message,
    hypothesisId,
    seq,
    data,
    timestamp: Date.now(),
    pageUrl: window.location.pathname + window.location.search,
    userAgent: navigator.userAgent.slice(0, 120),
  }

  // #region agent log
  fetch(CURSOR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': LINE_HANDSHAKE_SESSION,
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})

  postLocalDebugIngest(payload, LINE_HANDSHAKE_SESSION)

  if (isLoginDebugMode()) {
    loginWithAppDebugLog(location, `[${stage}] ${message}`, hypothesisId, { stage, seq, ...data })
  }

  if (isLineLiffBrowser() || isLoginDebugMode()) {
    void supabase.functions
      .invoke('login-debug-log', {
        body: {
          events: [
            {
              sessionId: LINE_HANDSHAKE_SESSION,
              seq,
              location,
              message: `[${stage}] ${message}`,
              hypothesisId,
              data: { stage, ...data },
              timestamp: payload.timestamp,
              pageUrl: payload.pageUrl,
              userAgent: payload.userAgent,
            },
          ],
        },
      })
      .catch(() => {})
  }
  // #endregion
}

export function flushLineHandshakeDebug(sync = false) {
  if (isLoginDebugMode()) flushLoginDebugRemote(sync)
}
