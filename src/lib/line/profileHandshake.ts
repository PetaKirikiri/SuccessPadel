import { FunctionsHttpError } from '@supabase/supabase-js'
import { syncProfileForUser } from '../authProfile'
import { lineHandshakeDebug } from '../debug/lineHandshakeDebug'
import { supabase } from '../supabaseClient'
import {
  ensureLineProfileConsent,
  getLineAccessToken,
  getLineIdToken,
  hasLiffId,
  initLiff,
  isLineLoggedIn,
  lineLoginRedirect,
  liffLoginCooldownActive,
} from './liff'
import { readLineProfilePatch } from './profileSync'

export type ProfileHandshakeResult = {
  ok: boolean
  mode: 'login' | 'connected' | null
  redirected: boolean
  error: string | null
}

async function edgeFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string }
      if (body.error) return body.error
    } catch {
      /* ignore */
    }
  }
  if (error instanceof Error) return error.message
  return 'LINE sign-in failed. Please try again.'
}

/**
 * Player profile page handshake (inside LINE):
 * - Registered LINE → login only
 * - New LINE on linkable guest → connect this padel_player + login
 */
export async function runLinePlayerProfileHandshake(
  padelPlayerId: string,
): Promise<ProfileHandshakeResult> {
  if (!hasLiffId()) {
    return { ok: false, mode: null, redirected: false, error: 'LINE is not configured.' }
  }

  await initLiff()

  // #region agent log
  lineHandshakeDebug('S9-profile', 'profileHandshake.ts:start', 'profile handshake start', 'H9', {
    padelPlayerIdPrefix: padelPlayerId.slice(0, 8),
    lineLoggedIn: isLineLoggedIn(),
  })
  // #endregion

  if (!isLineLoggedIn()) {
    if (liffLoginCooldownActive()) {
      return { ok: false, mode: null, redirected: false, error: 'LINE sign-in in progress…' }
    }
    lineLoginRedirect()
    return { ok: false, mode: null, redirected: true, error: null }
  }

  await ensureLineProfileConsent()

  const idToken = await getLineIdToken()
  if (!idToken) {
    return { ok: false, mode: null, redirected: false, error: 'Could not read your LINE session.' }
  }

  const accessToken = await getLineAccessToken()
  const profilePayload = await readLineProfilePatch()

  const { data, error } = await supabase.functions.invoke('line-liff-profile-handshake', {
    body: {
      id_token: idToken,
      access_token: accessToken ?? undefined,
      profile: profilePayload ?? undefined,
      padel_player_id: padelPlayerId,
    },
  })

  if (error) {
    const msg = await edgeFunctionErrorMessage(error)
    // #region agent log
    lineHandshakeDebug('S9-profile', 'profileHandshake.ts:error', 'handshake edge error', 'H9', {
      error: msg,
    })
    // #endregion
    return { ok: false, mode: null, redirected: false, error: msg }
  }

  const payload = data as {
    error?: string
    mode?: 'login' | 'connected'
    access_token?: string
    refresh_token?: string
    profile_id?: string
  }

  if (payload.error) {
    return { ok: false, mode: null, redirected: false, error: payload.error }
  }
  if (!payload.access_token || !payload.refresh_token) {
    return { ok: false, mode: null, redirected: false, error: 'Sign-in failed — no session returned.' }
  }

  const { error: sessErr } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })
  if (sessErr) {
    return { ok: false, mode: null, redirected: false, error: sessErr.message }
  }

  const { data: confirmed } = await supabase.auth.getSession()
  if (confirmed.session?.user) {
    await syncProfileForUser(confirmed.session.user)
  }

  // #region agent log
  lineHandshakeDebug('S9-profile', 'profileHandshake.ts:done', 'profile handshake complete', 'H9', {
    mode: payload.mode ?? null,
    profileIdPrefix: payload.profile_id?.slice(0, 8) ?? null,
  })
  // #endregion

  window.dispatchEvent(new Event('successpadel:profile-synced'))
  return {
    ok: true,
    mode: payload.mode ?? 'login',
    redirected: false,
    error: null,
  }
}

export function isPlayerProfilePath(pathname: string): boolean {
  return /^\/players\/[0-9a-f-]{36}$/i.test(pathname)
}
