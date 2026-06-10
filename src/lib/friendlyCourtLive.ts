export function friendlyCourtLivePath(
  sessionId: string,
  gameNumber: number,
  courtLabel: string,
): string {
  return `/friendly/${sessionId}/games/${gameNumber}/courts/${encodeURIComponent(courtLabel)}`
}

export function friendlyCourtSetupKey(
  sessionId: string,
  gameNumber: number,
  courtLabel: string,
): string {
  return `${sessionId}-${gameNumber}-${courtLabel}`
}
