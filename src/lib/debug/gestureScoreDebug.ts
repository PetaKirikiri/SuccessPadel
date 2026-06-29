const ENDPOINT = 'http://127.0.0.1:7695/ingest/c4960c9b-f3c9-4190-b564-b1526039f3c6'
const SESSION = '150bfe'

export function gestureScoreDebug(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
) {
  // #region agent log
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION },
    body: JSON.stringify({
      sessionId: SESSION,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}
