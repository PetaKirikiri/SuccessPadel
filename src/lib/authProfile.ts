import type { User } from '@supabase/supabase-js'
import { isLineCdnAvatarUrl, shouldRefreshLineAvatar } from './lineAvatar'
import { mirrorLineAvatarToStorage } from './profileAvatar'
import { syncLineProfileFromLiff } from './line/profileSync'
import { supabase } from './supabaseClient'
import type { Profile } from './types'

async function resolveAvatarForProfile(
  userId: string,
  stored: string | null | undefined,
  incoming: string | null | undefined,
): Promise<string | null> {
  if (!incoming || !shouldRefreshLineAvatar(stored, incoming)) return stored ?? null
  if (isLineCdnAvatarUrl(incoming)) {
    const mirrored = await mirrorLineAvatarToStorage(userId, incoming)
    return mirrored ?? incoming
  }
  return incoming
}

export async function syncProfileForUser(user: User): Promise<Profile | null> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    const metaName =
      typeof user.user_metadata?.display_name === 'string'
        ? user.user_metadata.display_name.trim()
        : ''
    const metaAvatar = user.user_metadata?.avatar_url as string | null | undefined
    const lineId = user.user_metadata?.line_user_id as string | undefined
    const staleName = !existing.display_name || existing.display_name === 'Player'
    const hasBetterName = Boolean(metaName && metaName !== 'Player')
    const needsAvatar = Boolean(
      metaAvatar && shouldRefreshLineAvatar(existing.avatar_url, metaAvatar),
    )
    const needsLineId = Boolean(lineId && !existing.line_user_id)

    if ((staleName && hasBetterName) || needsAvatar || needsLineId) {
      const patch: Record<string, string | null> = {}
      if (staleName && hasBetterName) patch.display_name = metaName
      if (needsAvatar) {
        patch.avatar_url = await resolveAvatarForProfile(
          user.id,
          existing.avatar_url,
          metaAvatar ?? null,
        )
      }
      if (needsLineId && lineId) patch.line_user_id = lineId

      const { data: updated } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select()
        .maybeSingle()

      if (updated) {
        await supabase.rpc('link_guest_rosters_by_email')
        return updated as Profile
      }
    }

    if (existing.line_user_id && existing.display_name === 'Player') {
      await syncLineProfileFromLiff(user.id)
    }

    const { data: latest } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    await supabase.rpc('link_guest_rosters_by_email')
    return (latest ?? existing) as Profile
  }

  const { data: ensured, error } = await supabase.rpc('ensure_profile')
  if (error) {
    console.error('ensure_profile failed', error.message)
    return null
  }

  const profile = (ensured as Profile) ?? null
  if (profile) await supabase.rpc('link_guest_rosters_by_email')
  return profile
}

export async function linkGuestRostersByEmail(): Promise<void> {
  await supabase.rpc('link_guest_rosters_by_email')
}
