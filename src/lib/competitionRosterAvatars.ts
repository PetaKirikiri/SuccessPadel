import { clubDisplayName } from './clubMemberDisplay'
import { supabase } from './supabaseClient'
import type { CompetitionPlayer, CompetitionRow } from '../hooks/useCompetitions'

type ProfileRow = { id: string; display_name: string | null; avatar_url: string | null }
type PadelRow = { id: string; display_name: string; profile_id: string | null }

function resolveRosterPlayer(
  sp: CompetitionPlayer,
  profilesById: Map<string, ProfileRow>,
  padelById: Map<string, PadelRow>,
): CompetitionPlayer {
  const directProfile = sp.profile_id ? profilesById.get(sp.profile_id) : undefined
  const padel = sp.padel_player_id ? padelById.get(sp.padel_player_id) : undefined
  const padelProfile = padel?.profile_id ? profilesById.get(padel.profile_id) : undefined

  const profileId = sp.profile_id ?? padelProfile?.id ?? padel?.profile_id ?? null
  const displayName =
    directProfile?.display_name?.trim() ||
    padelProfile?.display_name?.trim() ||
    padel?.display_name?.trim() ||
    sp.profiles?.display_name?.trim() ||
    sp.guest_name?.trim() ||
    null

  if (!displayName) return sp

  const avatarUrl =
    directProfile?.avatar_url ??
    padelProfile?.avatar_url ??
    sp.profiles?.avatar_url ??
    null

  return {
    ...sp,
    profile_id: profileId ?? sp.profile_id,
    profiles: profileId
      ? {
          id: profileId,
          display_name: clubDisplayName(profileId, displayName),
          avatar_url: avatarUrl,
        }
      : displayName
        ? {
            id: sp.profiles?.id ?? '',
            display_name: displayName,
            avatar_url: avatarUrl,
          }
        : sp.profiles,
  }
}

export async function enrichCompetitionRowsAvatars(
  rows: CompetitionRow[],
): Promise<CompetitionRow[]> {
  const profileIds = new Set<string>()
  const padelIds = new Set<string>()

  for (const row of rows) {
    for (const sp of row.session_players ?? []) {
      if (sp.profile_id) profileIds.add(sp.profile_id)
      if (sp.padel_player_id) padelIds.add(sp.padel_player_id)
      if (sp.profiles?.id) profileIds.add(sp.profiles.id)
    }
  }

  const padelRes =
    padelIds.size > 0
      ? await supabase
          .from('padel_players')
          .select('id, display_name, profile_id')
          .in('id', [...padelIds])
      : { data: [] as PadelRow[] }

  for (const padel of padelRes.data ?? []) {
    if (padel.profile_id) profileIds.add(padel.profile_id)
  }

  const profilesRes =
    profileIds.size > 0
      ? await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', [...profileIds])
      : { data: [] as ProfileRow[] }

  const profilesById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))
  const padelById = new Map((padelRes.data ?? []).map((p) => [p.id, p]))

  return rows.map((row) => ({
    ...row,
    session_players: (row.session_players ?? []).map((sp) =>
      resolveRosterPlayer(sp, profilesById, padelById),
    ),
  }))
}
