/** LINE profile picture URLs expire; hosted avatars in Supabase storage do not. */
export function isLineCdnAvatarUrl(url: string | null | undefined): boolean {
  return Boolean(url?.includes('profile.line-scdn.net'))
}

export function isHostedAvatarUrl(url: string | null | undefined): boolean {
  return Boolean(url?.includes('/storage/v1/object/public/avatars/'))
}

/** Re-pull LINE photo when the CDN URL changed or we only have an old hosted mirror. */
export function shouldMirrorLineAvatarOnSync(
  stored: string | null | undefined,
  incoming: string | null | undefined,
  lineLinked: boolean,
): boolean {
  if (!incoming || !isLineCdnAvatarUrl(incoming)) return false
  if (!stored) return true
  if (isLineCdnAvatarUrl(stored)) return stored !== incoming
  if (lineLinked && isHostedAvatarUrl(stored)) return true
  return false
}

export function shouldRefreshLineAvatar(
  stored: string | null | undefined,
  incoming: string | null | undefined,
  lineLinked = false,
): boolean {
  return shouldMirrorLineAvatarOnSync(stored, incoming, lineLinked)
}
