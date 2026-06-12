import { competitionPlayUrl } from './siteUrl'
import { sharePlayerProfile, type SharePlayerProfileResult } from './playerProfileShare'

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

export async function shareCompetitionInvite(options: {
  sessionId: string
  title: string
  text: string
}): Promise<SharePlayerProfileResult> {
  return sharePlayerProfile({
    url: competitionPlayUrl(options.sessionId),
    title: options.title,
    text: options.text,
  })
}
