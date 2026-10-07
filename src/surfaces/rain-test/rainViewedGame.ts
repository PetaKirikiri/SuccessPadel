type ViewStorage = Pick<Storage, 'getItem' | 'setItem'>

const viewKey = (competitionId: string) => `success-padel:rain-viewed-game:v1:${competitionId}`

/** Viewing preference only; never reads or writes the score ledger. */
export function readRainViewedGame(competitionId: string, roundCount: number, storage?: ViewStorage): number {
  try {
    const raw = (storage ?? window.localStorage).getItem(viewKey(competitionId))
    const game = raw === null ? NaN : Number(raw)
    return Number.isInteger(game) && game >= 1 && game <= roundCount ? game - 1 : 0
  } catch {
    return 0
  }
}

export function saveRainViewedGame(competitionId: string, index: number, roundCount: number, storage?: ViewStorage): void {
  if (!Number.isInteger(index) || index < 0 || index >= roundCount) return
  try {
    (storage ?? window.localStorage).setItem(viewKey(competitionId), String(index + 1))
  } catch {
    // Browsing still works when local storage is blocked or full.
  }
}
