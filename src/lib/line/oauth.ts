import { saveReturnTo } from '../authReturnTo'
import { syncProfileForUser } from '../authProfile'
import { supabase } from '../supabaseClient'

const channelId = import.meta.env.VITE_LINE_CHANNEL_ID as string | undefined
const configuredRedirect = import.meta.env.VITE_LINE_REDIRECT_URI as string | undefined
const STATE_KEY = 'line_oauth_state'

export function hasLineOAuth(): boolean {
  return Boolean(channelId)
}

/** Must match a Callback URL in LINE Developers exactly (no trailing slash). */
export function lineOAuthRedirectUri(): string {
  if (configuredRedirect) return configuredRedirect
  return `${window.location.origin}/login`
}

export function lineOAuthCallbackCode(search: string): string | null {
  return new URLSearchParams(search).get('code')
}

export function startLineOAuthLogin(returnPath: string): void {
  if (!channelId) return

  saveReturnTo(returnPath)
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: lineOAuthRedirectUri(),
    state,
    scope: 'profile openid',
  })

  window.location.assign(`https://access.line.me/oauth2/v2.1/authorize?${params}`)
}

export function consumeLineOAuthState(received: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  return Boolean(received && expected && received === expected)
}

export async function completeLineOAuthFromUrl(search: string): Promise<string | null> {
  const params = new URLSearchParams(search)
  const oauthError = params.get('error_description') ?? params.get('error')
  if (oauthError) return oauthError

  const code = params.get('code')
  const state = params.get('state')
  if (!code || !consumeLineOAuthState(state)) {
    return 'LINE sign-in failed. Please try again.'
  }

  const redirectUri = lineOAuthRedirectUri()
  const { data, error: fnError } = await supabase.functions.invoke('line-oauth', {
    body: { code, redirect_uri: redirectUri },
  })

  if (fnError) return fnError.message

  const payload = data as {
    error?: string
    access_token?: string
    refresh_token?: string
  }

  if (payload.error) {
    if (/LINE channel not configured/i.test(payload.error)) {
      return 'LINE login is not fully set up on the server yet. Ask your admin.'
    }
    return payload.error
  }
  if (!payload.access_token || !payload.refresh_token) {
    return 'Sign-in failed — no session returned.'
  }

  const { error: sessErr } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })

  if (sessErr) return sessErr.message

  const { data: confirmed } = await supabase.auth.getSession()
  if (!confirmed.session?.user) {
    return 'Sign-in did not stick — try again.'
  }

  await syncProfileForUser(confirmed.session.user)
  return null
}
