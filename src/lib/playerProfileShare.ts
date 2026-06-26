import { lineAppEntryUrl } from './line/liff'
import { playerProfilePath } from './playerProfileSlug'
import { shareSiteOrigin } from './siteUrl'

export function playerProfileShareUrl(
  playerId: string,
  competitionId?: string | null,
  displayName?: string | null,
): string {
  const path = playerProfilePath({ id: playerId, displayName, competitionId })
  return lineAppEntryUrl(path) ?? `${shareSiteOrigin()}${path}`
}

export type SharePlayerProfileResult = 'shared' | 'copied' | 'failed' | 'cancelled'

export async function sharePlayerProfile(options: {
  url: string
  title: string
  text: string
}): Promise<SharePlayerProfileResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(options.url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
