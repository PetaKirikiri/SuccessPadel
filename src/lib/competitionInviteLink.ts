const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const shortCode = /^[0-9a-f]{8}$/i

/** Permanent event identity, shared by normal navigation, QR codes and chat links. */
export function competitionInvitePath(id: string): string {
  if (uuid.test(id) || shortCode.test(id)) return `/c/${id.slice(0, 8).toLowerCase()}`
  return `/competitive?competition=${encodeURIComponent(id)}`
}

export function competitionInviteUrl(id: string): string {
  return `https://successpadel.app${competitionInvitePath(id)}`
}

export function isCompetitionInvitePath(pathname: string): boolean {
  return /^\/competitive\/?$/.test(pathname) || /^\/c\/[^/]+\/?$/.test(pathname)
}

/** Keep review/player and sign-in return parameters; retire only the old address. */
export function canonicalCompetitionInviteLocation(pathname: string, search = '', hash = ''): string | null {
  const params = new URLSearchParams(search)
  const code = /^\/c\/([0-9a-f]{8})\/?$/i.exec(pathname)?.[1]
  const ids = params.getAll('competition')
  const id = code ?? (/^\/competitive\/?$/.test(pathname) && ids.length === 1 && uuid.test(ids[0]) ? ids[0] : null)
  // Never resolve conflicting identities by quietly choosing one.
  if (!id || (code && ids.length) || params.has('eventId') || params.has('inviteCode')) return null
  params.delete('competition')
  params.delete('preview')
  const query = params.toString()
  return `${competitionInvitePath(id)}${query ? `?${query}` : ''}${hash}`
}

/** A supplied code must never fall back to a different competition. */
export function selectInvitedCompetition<T extends { id: string }>(rows: T[], id: string): T[] {
  const matches = rows.filter(row => shortCode.test(id)
    ? uuid.test(row.id) && row.id.toLowerCase().startsWith(`${id.toLowerCase()}-`)
    : row.id.toLowerCase() === id.toLowerCase())
  return matches.length === 1 ? matches : []
}
