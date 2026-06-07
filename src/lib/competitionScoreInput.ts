export function scoreDigitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function parseScoreField(value: string): number | null {
  if (value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

export type CourtScoreSubmit = {
  roundId: string
  courtId: string
  teamA: number
  teamB: number
}
