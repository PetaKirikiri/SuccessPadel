import { FunctionsHttpError } from '@supabase/supabase-js'
import { Browser } from '@capacitor/browser'
import { saveReturnTo } from '../authReturnTo'
import { syncProfileForUser } from '../authProfile'
import { claimPendingPadelPlayer } from '../claimPadelPlayer'
import { isNativeApp, NATIVE_LINE_REDIRECT_URI } from '../native/app'
import { siteOrigin } from '../siteUrl'
import { supabase } from '../supabaseClient'

const channelId = (import.meta.env.VITE_LINE_CHANNEL_ID as string | undefined)?.trim() || undefined
const configuredRedirect =
  (import.meta.env.VITE_LINE_REDIRECT_URI as string | undefined)?.trim() || undefined
const STATE_KEY = 'line_oauth_state'

export function hasLineOAuth(): boolean {
  return Boolean(channelId)
}

/** Must match a Callback URL in LINE Developers exactly. */
export function lineOAuthRedirectUri(): string {
  if (configuredRedirect) return configuredRedirect
  if (isNativeApp()) return NATIVE_LINE_REDIRECT_URI
  return `${siteOrigin()}/login`
}

export function lineOAuthCallbackCode(search: string): string | null {
  return new URLSearchParams(search).get('code')
}

export async function startLineOAuthLogin(returnPath: string): Promise<void> {
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
    disable_auto_login: 'true',
  })

  const authorizeUrl = `https://access.line.me/oauth2/v2.1/authorize?${params}`

  if (isNativeApp()) {
    await Browser.open({ url: authorizeUrl })
    return
  }

  window.location.assign(authorizeUrl)
}

export function consumeLineOAuthState(received: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  return Boolean(received && expected && received === expected)
}

async function oauthFunctionErrorMessage(error: unknown): Promise<string> {
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

  if (fnError) return oauthFunctionErrorMessage(fnError)

  const payload = data as {
    error?: string
    access_token?: string
    refresh_token?: string
  }

  if (payload.error) {
    if (/LINE_CHANNEL_SECRET|LINE channel not configured|Supabase secret missing/i.test(payload.error)) {
      return 'Server setup incomplete — LINE channel secret must be added to Supabase (see .env.example).'
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
  await claimPendingPadelPlayer()
  return null
}
