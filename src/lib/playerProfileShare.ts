import { lineAppEntryUrl } from './line/liff'
import { shareSiteOrigin } from './siteUrl'

export function playerProfileShareUrl(
  playerId: string,
  competitionId?: string | null,
): string {
  const params = competitionId ? `?competition=${encodeURIComponent(competitionId)}` : ''
  const path = `/players/${playerId}${params}`
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
