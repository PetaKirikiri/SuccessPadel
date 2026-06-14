/** Canonical LINE user id: U + 32 lowercase hex (OpenID `sub` casing varies). */
export function normalizeLineUserId(sub: string): string {
  const trimmed = sub.trim()
  const match = trimmed.match(/^([Uu])([0-9a-fA-F]{32})$/)
  if (match) return `U${match[2].toLowerCase()}`
  return trimmed
}

export function lineAuthEmail(sub: string): string {
  return `line_${normalizeLineUserId(sub).toLowerCase()}@successpadel.local`
}
