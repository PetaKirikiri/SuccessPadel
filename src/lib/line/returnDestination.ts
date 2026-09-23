import { competitionInviteUrl } from '../competitionInviteLink'
import { PLAYER_LINK_APP_ORIGIN } from './playerLinkReturnUrls'

export const LINE_RETURN_PARAM = 'sp_return_to'
export const LINE_RESUME_PATH = '/auth/line/resume'

/** Return destinations are public app paths, never arbitrary origins or callbacks. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return null
  try {
    const url = new URL(value, PLAYER_LINK_APP_ORIGIN)
    if (url.origin !== PLAYER_LINK_APP_ORIGIN || url.username || url.password) return null
    if (!/^\/(?:c\/[^/]+|competitive|competitions(?:\/[^/]+)?|players\/[^/]+|friendly(?:\/[^/]+)?|profile)\/?$/.test(url.pathname)) return null
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('liff.') || ['code', 'state', 'sp_line_attempt', LINE_RETURN_PARAM].includes(key)) url.searchParams.delete(key)
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return null }
}

/** HTTP short-link redirects may already have resolved the alias before JS runs. */
export function originalReturnPath(value: string): string {
  const path = safeReturnPath(value) ?? '/friendly'
  const url = new URL(path, PLAYER_LINK_APP_ORIGIN)
  const id = url.pathname === '/competitive' ? url.searchParams.get('competition') : null
  if (id && [...url.searchParams.keys()].every(key => key === 'competition') && !url.hash) {
    return safeReturnPath(competitionInviteUrl(id)) ?? path
  }
  return path
}

/** Query-only LIFF entry: never append /competitive to an old /login endpoint. */
export function lineReturnEntryUrl(liffId: string, destination: string): string {
  const params = new URLSearchParams({ [LINE_RETURN_PARAM]: originalReturnPath(destination), sp_line_attempt: '1' })
  return `https://liff.line.me/${liffId}?${params}`
}

/** Read primary liff.state as well as the final secondary-redirect query. */
export function carriedReturnPath(href: string): string | null {
  const url = new URL(href)
  const direct = url.searchParams.get(LINE_RETURN_PARAM)
  if (direct !== null) return safeReturnPath(direct)
  const state = url.searchParams.get('liff.state')
  if (!state) return null
  try {
    return safeReturnPath(new URL(state, PLAYER_LINK_APP_ORIGIN).searchParams.get(LINE_RETURN_PARAM))
  } catch { return null }
}

export function canonicalResumeUrl(destination: string, ticket?: string): string {
  const url = new URL(LINE_RESUME_PATH, PLAYER_LINK_APP_ORIGIN)
  url.searchParams.set(LINE_RETURN_PARAM, safeReturnPath(destination) ?? '/friendly')
  // One-use credential only in the fragment: excluded from HTTP/referrer logs.
  if (ticket) url.hash = new URLSearchParams({ ticket }).toString()
  return url.href
}
