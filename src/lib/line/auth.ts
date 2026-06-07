import { FunctionsHttpError } from '@supabase/supabase-js'
import { syncProfileForUser } from '../authProfile'
import { supabase } from '../supabaseClient'
import {
  clearLineProfileReconsentFlag,
  ensureLineProfileConsent,
  getLineAccessToken,
  getLineIdToken,
  hasLiffId,
  initLiff,
  isInLineClient,
  isLineLoggedIn,
  lineLoginRedirect,
} from './liff'
import { readLineProfilePatch, syncLineProfileFromLiff } from './profileSync'
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
    : '/login'
}

export async function startLineLogin(returnPath = '/login'): Promise<LineSignInResult> {
  if (hasLiffId()) {
    try {
      await initLiff()
      if (isInLineClient()) {
        return signInWithLine()
      }
    } catch {
      /* Safari / external browser — use OAuth below */
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

  if (!isLineLoggedIn()) {
    lineLoginRedirect()
    return { error: null, redirected: true }
  }

  await ensureLineProfileConsent()

  const idToken = await getLineIdToken()
  if (!idToken) {
    return { error: 'Could not read your LINE session.', redirected: false }
  }

  const profilePayload = await readLineProfilePatch()
  const accessToken = await getLineAccessToken()

  const { data, error } = await supabase.functions.invoke('line-liff-auth', {
    body: {
      id_token: idToken,
      access_token: accessToken ?? undefined,
      profile: profilePayload,
    },
  })

  if (error) {
    return { error: await edgeFunctionErrorMessage(error), redirected: false }
  }

  const payload = data as {
    error?: string
    access_token?: string
    refresh_token?: string
    display_name?: string
    avatar_url?: string
  }

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

  if (sessErr) {
    return { error: sessErr.message, redirected: false }
  }

  const { data: confirmed } = await supabase.auth.getSession()
  if (!confirmed.session?.user) {
    return { error: 'Sign-in did not stick — try again.', redirected: false }
  }

  const user = confirmed.session.user
  let resolvedName = payload.display_name ?? profilePayload?.display_name
  let resolvedAvatar = payload.avatar_url ?? profilePayload?.picture_url

  if (!resolvedName) {
    const liffPatch = await readLineProfilePatch()
    resolvedName = liffPatch?.display_name
    resolvedAvatar = liffPatch?.picture_url
  }

  if (resolvedName) {
    clearLineProfileReconsentFlag()
    await supabase
      .from('profiles')
      .update({
        display_name: resolvedName,
        avatar_url: resolvedAvatar ?? null,
        line_user_id: profilePayload?.user_id ?? undefined,
      })
      .eq('id', user.id)
  } else if (isInLineClient()) {
    await syncLineProfileFromLiff(user.id)
  }

  await syncProfileForUser(user)
  window.dispatchEvent(new Event('successpadel:profile-synced'))
  return { error: null, redirected: false }
}
