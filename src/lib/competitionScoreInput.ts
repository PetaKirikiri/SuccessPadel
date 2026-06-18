export function scoreDigitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function parseScoreField(value: string): number | null {
  if (value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

/** Stepper max for a single court score — not the americano play-to target. */
export const COURT_SCORE_INPUT_MAX = 99

/** Each side 0..max; must differ (e.g. 4–2, 6–4; not 7–5 or 3–3). */
export function isValidCappedGameScore(teamA: number, teamB: number, maxGames: number): boolean {
  if (teamA === teamB) return false
  return (
    teamA >= 0 &&
    teamB >= 0 &&
    teamA <= maxGames &&
    teamB <= maxGames
  )
}

export function courtScoresReady(teamAStr: string, teamBStr: string): boolean {
  return parseScoreField(teamAStr) !== null && parseScoreField(teamBStr) !== null
}

export function courtGameScoreMax(playTo?: number): number {
  return playTo ?? COURT_SCORE_INPUT_MAX
}

export function courtSubmitReady(
  teamAStr: string,
  teamBStr: string,
  playTo?: number,
  saved?: { teamAPoints?: number; teamBPoints?: number },
): boolean {
  if (!courtScoresReady(teamAStr, teamBStr)) return false
  const teamA = parseScoreField(teamAStr)!
  const teamB = parseScoreField(teamBStr)!
  if (playTo != null && !isValidCappedGameScore(teamA, teamB, playTo)) return false
  if (saved?.teamAPoints == null && saved?.teamBPoints == null) return true
  return saved?.teamAPoints !== teamA || saved?.teamBPoints !== teamB
}

export function bumpScoreField(value: string, delta: number, max?: number): string {
  const current = parseScoreField(value) ?? 0
  let next = Math.max(0, current + delta)
  if (max != null) next = Math.min(max, next)
  return String(next)
}

/** Score shown in inputs and used for submit — while editing, never fall back to saved. */
export function effectiveScoreField(
  draftValue: string | undefined,
  savedPoints: number | undefined,
  dirty: boolean,
): string {
  if (dirty && draftValue !== undefined) return draftValue
  if (draftValue != null && draftValue !== '') return draftValue
  if (savedPoints != null) return String(savedPoints)
  return ''
}

export type CourtScoreSubmit = {
  roundId: string
  courtId: string
  teamA: number
  teamB: number
}
