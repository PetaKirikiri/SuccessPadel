import { FunctionsHttpError } from '@supabase/supabase-js'
import {
  getLineAccessToken,
  getLineIdToken,
  hasLiffId,
  initLiff,
  isLineLoggedIn,
  lineAppEntryUrl,
  lineLoginRedirect,
} from './liff'
import { readLineProfilePatch } from './profileSync'
import { lineOAuthRedirectUri } from './oauth'
import { siteOrigin } from '../siteUrl'
import { supabase } from '../supabaseClient'
import { syncProfileForUser } from '../authProfile'

const channelId = (import.meta.env.VITE_LINE_CHANNEL_ID as string | undefined)?.trim() || undefined

export function hasLinePlayerLink(): boolean {
  return Boolean(channelId && hasLiffId())
}

/** Same callback as normal LINE login — must be registered in LINE Developers. */
export function linePlayerLinkRedirectUri(): string {
  return lineOAuthRedirectUri()
}

export function lineHandoffCompleteUrl(handoffToken: string): string {
  return `${siteOrigin()}/auth/line/complete?handoffToken=${encodeURIComponent(handoffToken)}`
}

async function edgeErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string }
      if (body.error) return body.error
    } catch {
      /* ignore */
    }
  }
  if (error instanceof Error) return error.message
  return 'LINE linking failed. Please try again.'
}

export type LinePlayerLinkRequest = {
  linkToken: string
  /** LIFF URL for LINE QR scanner only — never OAuth. */
  qrUrl: string
}

export function linePlayerLinkQrUrl(linkToken: string): string | null {
  return lineAppEntryUrl(`/login?lpl=${encodeURIComponent(linkToken)}`)
}

export function linkTokenFromLocation(search = window.location.search): string | null {
  const params = new URLSearchParams(search)
  const oauthState = params.get('state')
  if (oauthState?.startsWith('lpl_')) return oauthState

  const direct = params.get('lpl')
  if (direct?.startsWith('lpl_')) return direct

  const liffState = params.get('liff.state')
  if (liffState) {
    try {
      const decoded = decodeURIComponent(liffState)
      const fromQuery = new URLSearchParams(decoded.includes('?') ? decoded.split('?')[1] : '').get(
        'lpl',
      )
      if (fromQuery?.startsWith('lpl_')) return fromQuery
      const match = decoded.match(/lpl_[a-f0-9]+/)
      if (match) return match[0]
    } catch {
      /* ignore */
    }
  }

  return null
}

const ENTRY_PREFIX = 'sp_line_link_entry_'

export function shouldProcessLineLinkEntry(linkToken: string): boolean {
  const key = `${ENTRY_PREFIX}${linkToken}`
  if (sessionStorage.getItem(key)) return false
  sessionStorage.setItem(key, '1')
  return true
}

/** Create a single-use link request for QR display. Never redirects. */
export async function createLinePlayerLinkRequest(
  competitionId: string | null,
  padelPlayerId: string,
): Promise<{ request?: LinePlayerLinkRequest; error?: string }> {
  if (!channelId) return { error: 'LINE login is not configured' }
  if (!hasLiffId()) return { error: 'LINE app link is not configured' }

  const { data: linkToken, error } = await supabase.rpc('create_player_line_link_request', {
    p_competition_id: competitionId,
    p_padel_player_id: padelPlayerId,
  })

  if (error) return { error: error.message }
  if (!linkToken || typeof linkToken !== 'string') return { error: 'Could not start linking' }

  const resolvedQrUrl = linePlayerLinkQrUrl(linkToken)
  if (!resolvedQrUrl) return { error: 'LINE app link is not configured' }

  return {
    request: {
      linkToken,
      qrUrl: resolvedQrUrl,
    },
  }
}

/** Guest scanned QR and opened inside LINE — complete link via LIFF session. */
export async function completeLinePlayerLinkWithLiff(linkToken: string): Promise<{
  competitionId: string | null
  error?: string
}> {
  if (!hasLiffId()) {
    return { competitionId: null, error: 'LINE app link is not configured' }
  }

  await initLiff()

  if (!isLineLoggedIn()) {
    lineLoginRedirect()
    return { competitionId: null }
  }

  const idToken = await getLineIdToken()
  if (!idToken) {
    return { competitionId: null, error: 'Could not read your LINE session' }
  }

  const accessToken = await getLineAccessToken()
  const profile = await readLineProfilePatch()

  const { data, error: fnError } = await supabase.functions.invoke('line-liff-player-link', {
    body: {
      id_token: idToken,
      access_token: accessToken ?? undefined,
      profile: profile ?? undefined,
      link_token: linkToken,
    },
  })

  if (fnError) return { competitionId: null, error: await edgeErrorMessage(fnError) }

  const payload = data as {
    error?: string
    access_token?: string
    refresh_token?: string
    competition_id?: string | null
  }

  if (payload.error) return { competitionId: null, error: payload.error }
  if (!payload.access_token || !payload.refresh_token) {
    return { competitionId: null, error: 'Link failed — no session returned' }
  }

  const { error: sessErr } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })

  if (sessErr) return { competitionId: null, error: sessErr.message }

  const { data: confirmed } = await supabase.auth.getSession()
  if (!confirmed.session?.user) {
    return { competitionId: null, error: 'Session did not stick — try again' }
  }

  await syncProfileForUser(confirmed.session.user)

  return { competitionId: payload.competition_id ?? null }
}

export type LineLinkResult = {
  handoffToken: string
  competitionId: string | null
  padelPlayerId: string
  lineUserId: string
}

export async function completeLinePlayerLinkFromUrl(
  search: string,
): Promise<{ result?: LineLinkResult; error?: string }> {
  const params = new URLSearchParams(search)
  const oauthError = params.get('error_description') ?? params.get('error')
  if (oauthError) return { error: oauthError }

  const code = params.get('code')
  const linkToken = params.get('state')
  if (!code || !linkToken) {
    return { error: 'LINE linking failed. Please try again.' }
  }

  const { data, error: fnError } = await supabase.functions.invoke('line-player-link', {
    body: {
      code,
      redirect_uri: linePlayerLinkRedirectUri(),
      link_token: linkToken,
    },
  })

  if (fnError) return { error: await edgeErrorMessage(fnError) }

  const payload = data as {
    error?: string
    handoff_token?: string
    competition_id?: string | null
    padel_player_id?: string
    line_user_id?: string
  }

  if (payload.error) return { error: payload.error }
  if (!payload.handoff_token || !payload.padel_player_id || !payload.line_user_id) {
    return { error: 'Link failed — no handoff token returned.' }
  }

  return {
    result: {
      handoffToken: payload.handoff_token,
      competitionId: payload.competition_id ?? null,
      padelPlayerId: payload.padel_player_id,
      lineUserId: payload.line_user_id,
    },
  }
}

export async function consumeLineHandoffToken(handoffToken: string): Promise<{
  competitionId: string | null
  error?: string
}> {
  const { data, error: fnError } = await supabase.functions.invoke('line-handoff-complete', {
    body: { handoff_token: handoffToken },
  })

  if (fnError) return { competitionId: null, error: await edgeErrorMessage(fnError) }

  const payload = data as {
    error?: string
    access_token?: string
    refresh_token?: string
    competition_id?: string | null
  }

  if (payload.error) return { competitionId: null, error: payload.error }
  if (!payload.access_token || !payload.refresh_token) {
    return { competitionId: null, error: 'Handoff failed — no session returned.' }
  }

  const { error: sessErr } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })

  if (sessErr) return { competitionId: null, error: sessErr.message }

  const { data: confirmed } = await supabase.auth.getSession()
  if (!confirmed.session?.user) {
    return { competitionId: null, error: 'Session did not stick — try again.' }
  }

  await syncProfileForUser(confirmed.session.user)

  return { competitionId: payload.competition_id ?? null }
}

export function competitionPathAfterLink(competitionId: string | null): string {
  return competitionId ? `/competitions/${competitionId}` : '/'
}
