export function scoreDigitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function parseScoreField(value: string): number | null {
  if (value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  return n
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
