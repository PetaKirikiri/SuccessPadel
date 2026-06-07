import { FunctionsHttpError } from '@supabase/supabase-js'
import { saveReturnTo } from '../authReturnTo'
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
import { handshakeSiteOrigin, siteOrigin } from '../siteUrl'
import { supabase } from '../supabaseClient'
import { syncProfileForUser } from '../authProfile'

const COMPETITION_ID_KEY_PREFIX = 'sp_lpl_cid_'
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

/** LIFF entry — LINE QR scanner opens this inside the LINE app. */
export function linePlayerLinkQrUrl(linkToken: string, competitionId: string | null = null): string | null {
  return lineAppEntryUrl(`${PLAYER_LINK_HANDOFF_PATH}?${playerLinkLoginQuery(linkToken, competitionId)}`)
}

function playerLinkLoginQuery(linkToken: string, competitionId: string | null): string {
  const params = new URLSearchParams({ lpl: linkToken })
  if (competitionId) params.set('cid', competitionId)
  return params.toString()
}

export function rememberPlayerLinkCompetition(
  linkToken: string,
  competitionId: string | null,
): void {
  if (!competitionId) return
  sessionStorage.setItem(`${COMPETITION_ID_KEY_PREFIX}${linkToken}`, competitionId)
  saveReturnTo(`/competitions/${competitionId}`)
}

export const PLAYER_LINK_HANDOFF_PATH = '/link'

/** Safari / default browser URL — always Vercel origin, never liff.line.me. */
export function playerLinkBrowserUrl(linkToken: string, competitionId: string | null = null): string {
  return `${handshakeSiteOrigin()}${PLAYER_LINK_HANDOFF_PATH}?${playerLinkLoginQuery(linkToken, competitionId)}`
}

function buildLineAuthorizeUrl(linkToken: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId!,
    redirect_uri: linePlayerLinkRedirectUri(),
    state: linkToken,
    scope: 'profile openid',
  })
  return `https://access.line.me/oauth2/v2.1/authorize?${params}`
}

export type LinePlayerLinkLiffResult = {
  handoffToken: string
  competitionId: string | null
  redirected?: boolean
  error?: string
}

/** Finish link inside LINE in-app browser after Allow — Supabase stores everything. */
export async function completeLinePlayerLinkInLiff(
  linkToken: string,
): Promise<LinePlayerLinkLiffResult> {
  if (!hasLiffId()) {
    return { handoffToken: '', competitionId: null, error: 'LINE app link is not configured' }
  }

  await initLiff()

  if (!isLineLoggedIn()) {
    lineLoginRedirect()
    return { handoffToken: '', competitionId: null, redirected: true }
  }

  const idToken = await getLineIdToken()
  if (!idToken) {
    return {
      handoffToken: '',
      competitionId: null,
      error: 'Could not read your LINE session. Tap Allow when prompted.',
    }
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

  if (fnError) {
    return { handoffToken: '', competitionId: null, error: await edgeErrorMessage(fnError) }
  }

  const payload = data as {
    error?: string
    handoff_token?: string
    competition_id?: string | null
  }

  if (payload.error) {
    return { handoffToken: '', competitionId: null, error: payload.error }
  }
  if (!payload.handoff_token) {
    return { handoffToken: '', competitionId: null, error: 'Link failed — no handoff token.' }
  }

  return {
    handoffToken: payload.handoff_token,
    competitionId: payload.competition_id ?? null,
  }
}

/** Safari URL: sign in + land on the competition scoreboard. */
export function playerLinkScoreboardHandoffUrl(handoffToken: string): string {
  return lineHandoffCompleteUrl(handoffToken)
}

/** External browser only — starts LINE OAuth for player link. */
export function startPlayerLinkOAuth(linkToken: string): void {
  if (!channelId) return
  const stored = sessionStorage.getItem(`${COMPETITION_ID_KEY_PREFIX}${linkToken}`)
  if (stored) saveReturnTo(`/competitions/${stored}`)
  window.location.assign(buildLineAuthorizeUrl(linkToken))
}

function linkTokenFromParams(params: URLSearchParams): string | null {
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
      const match = decoded.match(/lpl_[a-f0-9-]+/)
      if (match) return match[0]
    } catch {
      /* ignore */
    }
  }

  return null
}

export function linkTokenFromLocation(
  search = window.location.search,
  hash = window.location.hash,
): string | null {
  const fromSearch = linkTokenFromParams(new URLSearchParams(search))
  if (fromSearch) return fromSearch

  if (hash) {
    const hashBody = hash.replace(/^#\/?/, '')
    const fromHash = linkTokenFromParams(
      new URLSearchParams(hashBody.includes('?') ? hashBody.split('?')[1] : hashBody),
    )
    if (fromHash) return fromHash
  }

  const hrefMatch = window.location.href.match(/lpl_[a-f0-9-]+/)
  return hrefMatch?.[0] ?? null
}

export function competitionIdFromPlayerLinkSearch(search: string): string | null {
  const cid = new URLSearchParams(search).get('cid')
  if (cid && UUID_RE.test(cid)) return cid

  const token = linkTokenFromLocation(search)
  if (!token) return null

  const stored = sessionStorage.getItem(`${COMPETITION_ID_KEY_PREFIX}${token}`)
  return stored && UUID_RE.test(stored) ? stored : null
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

  rememberPlayerLinkCompetition(linkToken, competitionId)

  const liffEntryPath = `${PLAYER_LINK_HANDOFF_PATH}?${playerLinkLoginQuery(linkToken, competitionId)}`
  const resolvedQrUrl = lineAppEntryUrl(liffEntryPath)
  if (!resolvedQrUrl) return { error: 'LINE app link is not configured' }

  return {
    request: {
      linkToken,
      qrUrl: resolvedQrUrl,
    },
  }
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

export function resolveCompetitionPathAfterLink(
  competitionId: string | null,
  search = '',
): string {
  return competitionPathAfterLink(competitionId ?? competitionIdFromPlayerLinkSearch(search))
}
