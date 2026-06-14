import { supabase } from '../supabaseClient'
import { mirrorLineAvatarToStorage } from '../profileAvatar'
import { isLineCdnAvatarUrl, shouldRefreshLineAvatar } from '../lineAvatar'
import {
  getDecodedLineClaims,
  getLineProfile,
  hasLiffId,
  initLiff,
  isInLineClient,
  isLineLoggedIn,
} from './liff'

export type LineProfilePatch = {
  display_name: string
  picture_url?: string
  user_id?: string
}

export async function readLineProfilePatch(): Promise<LineProfilePatch | null> {
  if (!hasLiffId()) return null

  await initLiff()
  if (!isLineLoggedIn()) return null

  try {
    const profile = await getLineProfile()
    if (profile?.displayName?.trim()) {
      return {
        display_name: profile.displayName.trim(),
        picture_url: profile.pictureUrl ?? undefined,
        user_id: profile.userId,
      }
    }
  } catch {
    /* profile scope may be missing */
  }

  const decoded = getDecodedLineClaims()
  if (decoded?.name?.trim()) {
    return {
      display_name: decoded.name.trim(),
      picture_url: decoded.picture,
      user_id: decoded.sub,
    }
  }

  return null
}

export async function applyLineProfilePatch(
  userId: string,
  patch: LineProfilePatch,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  const staleName =
    !existing?.display_name ||
    existing.display_name === 'Player' ||
    /^line_[0-9a-f]{32}$/i.test(existing.display_name)

  let avatarUrl = patch.picture_url ?? null
  if (avatarUrl && isLineCdnAvatarUrl(avatarUrl)) {
    const mirrored = await mirrorLineAvatarToStorage(userId, avatarUrl)
    if (mirrored) avatarUrl = mirrored
  }

  const profileUpdate: Record<string, string | null> = {}
  if (staleName && patch.display_name) profileUpdate.display_name = patch.display_name
  if (avatarUrl && shouldRefreshLineAvatar(existing?.avatar_url, avatarUrl)) {
    profileUpdate.avatar_url = avatarUrl
  }
  if (patch.user_id) profileUpdate.line_user_id = patch.user_id

  if (Object.keys(profileUpdate).length === 0) return true

  const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', userId)

  return !error
}

/** Pull LINE name/photo from LIFF when logged in inside the LINE app. */
export async function syncLineProfileFromLiff(userId: string): Promise<boolean> {
  if (!isInLineClient()) return false

  const patch = await readLineProfilePatch()
  if (!patch) return false

  return applyLineProfilePatch(userId, patch)
}
