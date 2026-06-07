const LOCAL_INGEST =
  'http://127.0.0.1:7695/ingest/c4960c9b-f3c9-4190-b564-b1526039f3c6'

export function isLocalDebugIngestEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

export function postLocalDebugIngest(payload: unknown, sessionId = '8bc41b'): void {
  if (!isLocalDebugIngestEnabled()) return
  fetch(LOCAL_INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': sessionId },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
