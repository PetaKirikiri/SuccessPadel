/** UI gate only; this does not grant database permissions or replace server checks. */
export function canManageMembers(loading: boolean, userId?: string | null, profile?: { id: string; is_admin?: boolean | null } | null): boolean {
  return !loading && Boolean(userId && profile?.id === userId && profile.is_admin)
}
