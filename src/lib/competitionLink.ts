export function competitionRunUrl(sessionId: string): string {
  return `${window.location.origin}/competitions/${sessionId}/run`
}

export async function copyCompetitionLink(sessionId: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(competitionRunUrl(sessionId))
    return true
  } catch {
    return false
  }
}
