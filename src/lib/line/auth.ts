import { syncProfileForUser } from '../authProfile'
import { supabase } from '../supabaseClient'
import {
  getLineIdToken,
  hasLiffId,
  initLiff,
  isInLineClient,
  isLineLoggedIn,
  lineAppEntryUrl,
  lineLoginRedirect,
} from './liff'
import { hasLineOAuth, startLineOAuthLogin } from './oauth'

export type LineSignInResult = {
  error: string | null
  redirected: boolean
}

export function isLineLoginConfigured(): boolean {
  return hasLineOAuth() || hasLiffId()
}

export async function startLineLogin(returnPath = '/login'): Promise<LineSignInResult> {
  if (isInLineClient() && hasLiffId()) {
    return signInWithLine()
  }

  // LIFF opens the LINE app on phones (use instead of web OAuth when possible).
  if (hasLiffId()) {
    const path =
      returnPath && !returnPath.startsWith('/auth/') && returnPath !== '/login'
        ? returnPath
        : '/login'
    const url = lineAppEntryUrl(path)
    if (url) {
      window.location.assign(url)
      return { error: null, redirected: true }
    }
  }

  if (hasLineOAuth()) {
    startLineOAuthLogin(returnPath)
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

  const idToken = await getLineIdToken()
  if (!idToken) {
    return { error: 'Could not read your LINE session.', redirected: false }
  }

  const { data, error } = await supabase.functions.invoke('line-liff-auth', {
    body: { id_token: idToken },
  })

  if (error) {
    return { error: error.message, redirected: false }
  }

  const payload = data as {
    error?: string
    access_token?: string
    refresh_token?: string
  }

  if (payload.error) {
    return { error: payload.error, redirected: false }
  }

  if (!payload.access_token || !payload.refresh_token) {
    return { error: 'Sign-in failed — no session returned.', redirected: false }
  }

  const { data: sessionData, error: sessErr } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })

  if (sessErr) {
    return { error: sessErr.message, redirected: false }
  }

  if (sessionData.user) {
    await syncProfileForUser(sessionData.user)
  }

  return { error: null, redirected: false }
}
