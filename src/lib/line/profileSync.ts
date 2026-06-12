import { supabase } from '../supabaseClient'
import { mirrorLineAvatarToStorage } from '../profileAvatar'
import { isLineCdnAvatarUrl } from '../lineAvatar'
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
  let avatarUrl = patch.picture_url ?? null
  if (avatarUrl && isLineCdnAvatarUrl(avatarUrl)) {
    const mirrored = await mirrorLineAvatarToStorage(userId, avatarUrl)
    if (mirrored) avatarUrl = mirrored
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: patch.display_name,
      avatar_url: avatarUrl,
      ...(patch.user_id ? { line_user_id: patch.user_id } : {}),
    })
    .eq('id', userId)

  return !error
}

/** Pull LINE name/photo from LIFF when logged in inside the LINE app. */
export async function syncLineProfileFromLiff(userId: string): Promise<boolean> {
  if (!isInLineClient()) return false

  const patch = await readLineProfilePatch()
  if (!patch) return false

  return applyLineProfilePatch(userId, patch)
}
