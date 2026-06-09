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
  created_at: string
}

export type ResolvedPlayerProfile = {
  profile: PublicPlayerProfile | null
  guestName: string | null
  guestAvatarUrl: string | null
  padelPlayerId: string | null
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
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
  }
}

async function fetchProfileById(profileId: string): Promise<PublicPlayerProfile | null> {
  const { data, error } = await supabase.rpc('get_player_profile', { p_profile_id: profileId })
  if (error) return null
  return parsePublicProfile(data)
}

async function fetchPadelPlayerIdForProfile(profileId: string): Promise<string | null> {
  const { data } = await supabase
    .from('padel_players')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle()
  return data?.id ?? null
}

export async function resolvePlayerProfile(playerId: string): Promise<ResolvedPlayerProfile> {
  const direct = await fetchProfileById(playerId)
  if (direct) {
    const padelPlayerId = await fetchPadelPlayerIdForProfile(direct.id)
    return { profile: direct, guestName: null, guestAvatarUrl: null, padelPlayerId }
  }

  const { data: padel } = await supabase
    .from('padel_players')
    .select('id, display_name, profile_id')
    .eq('id', playerId)
    .maybeSingle()

  if (!padel) {
    return { profile: null, guestName: null, guestAvatarUrl: null, padelPlayerId: null }
  }

  if (padel.profile_id) {
    const linked = await fetchProfileById(padel.profile_id)
    if (linked) {
      return {
        profile: linked,
        guestName: null,
        guestAvatarUrl: null,
        padelPlayerId: padel.id,
      }
    }
  }

  return {
    profile: null,
    guestName: padel.display_name,
    guestAvatarUrl: null,
    padelPlayerId: padel.id,
  }
}
