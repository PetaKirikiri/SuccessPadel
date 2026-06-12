import { supabase } from './supabaseClient'
import type { CompetitionRow } from '../hooks/useCompetitions'

export async function enrichCompetitionRowsAvatars(
  rows: CompetitionRow[],
): Promise<CompetitionRow[]> {
  const profileIds = [
    ...new Set(
      rows.flatMap((row) =>
        (row.session_players ?? [])
          .map((sp) => sp.profile_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  ]
  if (profileIds.length === 0) return rows

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', profileIds)

  if (!profiles?.length) return rows

  const byId = new Map(profiles.map((p) => [p.id, p]))

  return rows.map((row) => ({
    ...row,
    session_players: (row.session_players ?? []).map((sp) => {
      if (!sp.profile_id) return sp
      const profile = byId.get(sp.profile_id)
      if (!profile) return sp
      return {
        ...sp,
        profiles: {
          id: profile.id,
          display_name: sp.profiles?.display_name ?? profile.display_name,
          avatar_url: sp.profiles?.avatar_url ?? profile.avatar_url ?? null,
        },
      }
    }),
  }))
}
