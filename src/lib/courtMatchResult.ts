/** Which side won a finished court match from numeric scores, or null if unknown/tied. */
export function courtMatchWinnerTeam(
  scoreA?: string,
  scoreB?: string,
): 'a' | 'b' | null {
  const a = Number.parseInt(scoreA ?? '', 10)
  const b = Number.parseInt(scoreB ?? '', 10)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (a === b) return null
  return a > b ? 'a' : 'b'
}
