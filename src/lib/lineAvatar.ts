/** LINE profile picture URLs expire; hosted avatars in Supabase storage do not. */
export function isLineCdnAvatarUrl(url: string | null | undefined): boolean {
  return Boolean(url?.includes('profile.line-scdn.net'))
}

export function shouldRefreshLineAvatar(
  stored: string | null | undefined,
  incoming: string | null | undefined,
): boolean {
  if (!incoming) return false
  if (!stored) return true
  if (isLineCdnAvatarUrl(stored)) return stored !== incoming
  return false
}
