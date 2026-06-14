import { FunctionsHttpError } from '@supabase/supabase-js'
import { syncProfileForUser } from '../authProfile'
import { claimPendingPadelPlayer } from '../claimPadelPlayer'
import { lineHandshakeDebug } from '../debug/lineHandshakeDebug'
import { supabase } from '../supabaseClient'
import {
  clearLiffLoginCooldown,
  ensureLineProfileConsent,
  getLineAccessToken,
  getLineIdToken,
  hasLiffId,
  initLiff,
  isInLineClient,
  isLineLiffBrowser,
  isLineLoggedIn,
  lineLoginRedirect,
  liffLoginCooldownActive,
} from './liff'
import { handshakeSiteOrigin } from '../siteUrl'
import { readLineProfilePatch } from './profileSync'
import { hasLineOAuth, startLineOAuthLogin } from './oauth'

export type LineSignInResult = {
  error: string | null
  redirected: boolean
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

export function isLineLoginConfigured(): boolean {
  return hasLineOAuth() || hasLiffId()
}

export function isBrowserLineLoginConfigured(): boolean {
  return hasLineOAuth()
}

function lineEntryPath(returnPath: string): string {
  return returnPath && !returnPath.startsWith('/auth/') && returnPath !== '/login'
    ? returnPath
    : '/friendly'
}

async function initLiffWithTimeout(ms = 10_000): Promise<void> {
  await Promise.race([
    initLiff(),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('LIFF init timed out')), ms)
    }),
  ])
}

export async function startLineLogin(returnPath = '/friendly'): Promise<LineSignInResult> {
  if (hasLiffId() && isLineLiffBrowser()) {
    try {
      await initLiffWithTimeout()
      if (isInLineClient()) {
        return signInWithLine()
      }
    } catch {
      /* LINE webview unavailable — use OAuth below */
    }
  }

  if (hasLineOAuth()) {
    await startLineOAuthLogin(lineEntryPath(returnPath))
    return { error: null, redirected: true }
  }

  return {
    error: 'LINE sign-in is not set up yet.',
    redirected: false,
  }
}

export async function signInWithLine(): Promise<LineSignInResult> {
  if (!hasLiffId()) {
    return { error: 'LINE sign-in is not set up yet.', redirected: false }
  }

  await initLiff()

  const lineLoggedIn = isLineLoggedIn()
  // #region agent log
  lineHandshakeDebug('S4-liff-session', 'auth.ts:signIn', 'LIFF session check', 'H3', {
    lineLoggedIn,
    inClient: isInLineClient(),
  })
  // #endregion

  if (!lineLoggedIn) {
    if (liffLoginCooldownActive() && window.location.pathname === '/login') {
      // #region agent log
      lineHandshakeDebug('S4-liff-session', 'auth.ts:cooldown', 'LIFF login cooldown on /login', 'H7', {})
      // #endregion
      return {
        error: 'LINE sign-in did not complete. Close this tab and reopen from LINE.',
        redirected: false,
      }
    }
    const redirectUri = `${handshakeSiteOrigin()}/login`
    // #region agent log
    lineHandshakeDebug('S4-liff-session', 'auth.ts:redirect', 'calling lineLoginRedirect', 'H6', {
      redirectUri,
      pathname: window.location.pathname,
      inClient: isInLineClient(),
    })
    // #endregion
    lineLoginRedirect()
    return { error: null, redirected: true }
  }

  await ensureLineProfileConsent()

  const idToken = await getLineIdToken()
  const profilePayload = await readLineProfilePatch()
  const accessToken = await getLineAccessToken()

  // #region agent log
  lineHandshakeDebug('S4-liff-session', 'auth.ts:tokens', 'LINE tokens read', 'H3', {
    hasIdToken: Boolean(idToken),
    hasAccessToken: Boolean(accessToken),
    profileName: profilePayload?.display_name ? 'yes' : 'no',
    lineUserIdPrefix: profilePayload?.user_id?.slice(0, 6) ?? null,
  })
  // #endregion

  if (!idToken) {
    return { error: 'Could not read your LINE session.', redirected: false }
  }

  // #region agent log
  lineHandshakeDebug('S5-edge', 'auth.ts:invoke', 'calling line-liff-auth', 'H4', {})
  // #endregion

  const invokeAuth = supabase.functions.invoke('line-liff-auth', {
    body: {
      id_token: idToken,
      access_token: accessToken ?? undefined,
      profile: profilePayload,
    },
  })
  const { data, error } = await Promise.race([
    invokeAuth,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('LINE sign-in timed out. Try again.')), 25_000)
    }),
  ])

  if (error) {
    const msg = await edgeFunctionErrorMessage(error)
    // #region agent log
    lineHandshakeDebug('S6-edge', 'auth.ts:edge-error', 'line-liff-auth invoke error', 'H4', {
      error: msg,
    })
    // #endregion
    return { error: msg, redirected: false }
  }

  const payload = data as {
    error?: string
    access_token?: string
    refresh_token?: string
    display_name?: string
    avatar_url?: string
    matched_profile_id?: string
    matched_existing?: boolean
    created_new_user?: boolean
    line_sub_normalized?: string
  }

  // #region agent log
  lineHandshakeDebug('S6-edge', 'auth.ts:edge-ok', 'line-liff-auth response', 'H4', {
    payloadError: payload.error ?? null,
    hasAccessToken: Boolean(payload.access_token),
    hasRefreshToken: Boolean(payload.refresh_token),
    displayName: payload.display_name ? 'yes' : 'no',
    matchedProfileIdPrefix: payload.matched_profile_id?.slice(0, 8) ?? null,
    matchedExisting: payload.matched_existing ?? null,
    createdNewUser: payload.created_new_user ?? null,
    lineSubNormalized: payload.line_sub_normalized?.slice(0, 6) ?? null,
  })
  // #endregion

  if (payload.error) {
    return { error: payload.error, redirected: false }
  }

  if (!payload.access_token || !payload.refresh_token) {
    return { error: 'Sign-in failed — no session returned.', redirected: false }
  }

  const { error: sessErr } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })

  // #region agent log
  lineHandshakeDebug('S7-session', 'auth.ts:setSession', 'setSession result', 'H5', {
    sessErr: sessErr?.message ?? null,
  })
  // #endregion

  if (sessErr) {
    return { error: sessErr.message, redirected: false }
  }

  const { data: confirmed } = await supabase.auth.getSession()
  // #region agent log
  lineHandshakeDebug('S7-session', 'auth.ts:confirmed', 'getSession after setSession', 'H5', {
    hasSession: Boolean(confirmed.session?.user),
    userIdPrefix: confirmed.session?.user?.id?.slice(0, 8) ?? null,
  })
  // #endregion

  if (!confirmed.session?.user) {
    return { error: 'Sign-in did not stick — try again.', redirected: false }
  }

  const user = confirmed.session.user

  await syncProfileForUser(user)
  await claimPendingPadelPlayer()
  clearLiffLoginCooldown()
  window.dispatchEvent(new Event('successpadel:profile-synced'))
  // #region agent log
  lineHandshakeDebug('S8-ui', 'auth.ts:done', 'signInWithLine complete', 'H5', {
    userIdPrefix: user.id.slice(0, 8),
    emailDomain: user.email?.split('@')[1] ?? null,
  })
  // #endregion
  return { error: null, redirected: false }
}
