import { competitionPlayUrl } from './siteUrl'

export function competitionRunUrl(sessionId: string): string {
  return competitionPlayUrl(sessionId)
}

export async function copyCompetitionLink(sessionId: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(competitionPlayUrl(sessionId))
    return true
  } catch {
    return false
  }
}
