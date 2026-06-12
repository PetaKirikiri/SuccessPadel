import { supabase } from './supabaseClient'
import type { PlaySide } from './types'

export type PublicPlayerProfile = {
  id: string
  display_name: string
  avatar_url: string | null
  playtomic_number: string | null
  racket: string | null
  play_style: string | null
  preferred_side: PlaySide | null
  enjoys_fun_games: boolean
  usually_free: string | null
  gender: string | null
  dominant_hand: 'left' | 'right' | null
  skill_level: string | null
  created_at: string
  line_user_id: string | null
  is_admin?: boolean
}

export type ResolvedPlayerProfile = {
  profile: PublicPlayerProfile | null
  guestName: string | null
  guestAvatarUrl: string | null
  padelPlayerId: string | null
  padelLineUserId: string | null
  /** Unlinked padel_players.id that can receive a LINE QR link. */
  linkablePadelPlayerId: string | null
}

function parsePublicProfile(data: unknown): PublicPlayerProfile | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.display_name !== 'string') return null
  return {
    id: row.id,
    display_name: row.display_name,
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    playtomic_number: typeof row.playtomic_number === 'string' ? row.playtomic_number : null,
    racket: typeof row.racket === 'string' ? row.racket : null,
    play_style: typeof row.play_style === 'string' ? row.play_style : null,
    preferred_side:
      row.preferred_side === 'left' || row.preferred_side === 'right' || row.preferred_side === 'both'
        ? row.preferred_side
        : null,
    enjoys_fun_games: Boolean(row.enjoys_fun_games),
    usually_free: typeof row.usually_free === 'string' ? row.usually_free : null,
    gender: typeof row.gender === 'string' ? row.gender : null,
    dominant_hand:
      row.dominant_hand === 'left' || row.dominant_hand === 'right'
        ? row.dominant_hand
        : null,
    skill_level: typeof row.skill_level === 'string' ? row.skill_level : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    line_user_id: typeof row.line_user_id === 'string' ? row.line_user_id : null,
    is_admin: Boolean(row.is_admin),
  }
}

async function fetchProfileById(profileId: string): Promise<PublicPlayerProfile | null> {
  const { data, error } = await supabase.rpc('get_player_profile', { p_profile_id: profileId })
  if (error) return null
  const parsed = parsePublicProfile(data)
  if (!parsed) return null
  const { data: lineRow } = await supabase
    .from('profiles')
    .select('line_user_id')
    .eq('id', profileId)
    .maybeSingle()
  return { ...parsed, line_user_id: lineRow?.line_user_id ?? parsed.line_user_id }
}

async function fetchPadelPlayerIdForProfile(profileId: string): Promise<string | null> {
  const { data } = await supabase
    .from('padel_players')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle()
  return data?.id ?? null
}

async function fetchUnlinkedPadelPlayerById(padelPlayerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('padel_players')
    .select('id, profile_id')
    .eq('id', padelPlayerId)
    .maybeSingle()
  if (!data || data.profile_id) return null
  return data.id
}

async function fetchUnlinkedPadelPlayerByName(displayName: string): Promise<string | null> {
  const normalized = displayName.trim().toLowerCase()
  if (!normalized) return null
  const { data } = await supabase
    .from('padel_players')
    .select('id')
    .is('profile_id', null)
    .eq('normalized_name', normalized)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

async function resolveLinkablePadelPlayerId(
  profile: PublicPlayerProfile | null,
  padel: { id: string; display_name: string; profile_id: string | null } | null,
  playerId: string,
): Promise<string | null> {
  if (padel && !padel.profile_id) return padel.id

  const byUrl = await fetchUnlinkedPadelPlayerById(playerId)
  if (byUrl) return byUrl

  if (!profile || profile.line_user_id) return null

  const linkedPadelId = await fetchPadelPlayerIdForProfile(profile.id)
  if (linkedPadelId) return linkedPadelId

  return fetchUnlinkedPadelPlayerByName(profile.display_name)
}

export async function resolvePlayerProfile(playerId: string): Promise<ResolvedPlayerProfile> {
  const empty: ResolvedPlayerProfile = {
    profile: null,
    guestName: null,
    guestAvatarUrl: null,
    padelPlayerId: null,
    padelLineUserId: null,
    linkablePadelPlayerId: null,
  }

  const { data: padelById } = await supabase
    .from('padel_players')
    .select('id, display_name, profile_id, line_user_id')
    .eq('id', playerId)
    .maybeSingle()

  const direct = await fetchProfileById(playerId)
  if (direct) {
    const padelPlayerId = await fetchPadelPlayerIdForProfile(direct.id)
    const linkablePadelPlayerId = await resolveLinkablePadelPlayerId(direct, padelById, playerId)
    return {
      profile: direct,
      guestName: null,
      guestAvatarUrl: null,
      padelPlayerId: padelPlayerId ?? padelById?.id ?? null,
      padelLineUserId: padelById?.line_user_id ?? null,
      linkablePadelPlayerId,
    }
  }

  if (!padelById) return empty

  if (padelById.profile_id) {
    const linked = await fetchProfileById(padelById.profile_id)
    if (linked) {
      const linkablePadelPlayerId = await resolveLinkablePadelPlayerId(linked, padelById, playerId)
      return {
        profile: linked,
        guestName: null,
        guestAvatarUrl: null,
        padelPlayerId: padelById.id,
        padelLineUserId: padelById.line_user_id ?? null,
        linkablePadelPlayerId,
      }
    }
  }

  return {
    profile: null,
    guestName: padelById.display_name,
    guestAvatarUrl: null,
    padelPlayerId: padelById.id,
    padelLineUserId: padelById.line_user_id ?? null,
    linkablePadelPlayerId: padelById.profile_id ? null : padelById.id,
  }
}
