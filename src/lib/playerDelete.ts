import { supabase } from './supabaseClient'

export type AdminDeleteCandidate = {
  id: string
  kind: 'profile' | 'guest_padel'
  lineUserId?: string | null
  isAdmin?: boolean
}

export function isLineLinked(lineUserId?: string | null): boolean {
  return Boolean(lineUserId?.trim())
}

export function canAdminDeletePlayer(
  candidate: AdminDeleteCandidate,
  viewerUserId: string | undefined,
  isAdmin: boolean,
): boolean {
  if (!isAdmin || !viewerUserId) return false
  if (candidate.isAdmin) return false
  if (isLineLinked(candidate.lineUserId)) return false
  if (candidate.kind === 'profile' && candidate.id === viewerUserId) return false
  return true
}

export async function adminDeletePlayer(playerId: string): Promise<string | null> {
  const { error } = await supabase.rpc('admin_delete_player', { p_player_id: playerId })
  return error?.message ?? null
}
