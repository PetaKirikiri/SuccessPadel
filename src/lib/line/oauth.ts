import { saveReturnTo } from '../authReturnTo'

const channelId = import.meta.env.VITE_LINE_CHANNEL_ID as string | undefined
const STATE_KEY = 'line_oauth_state'

export function hasLineOAuth(): boolean {
  return Boolean(channelId)
}

export function lineOAuthRedirectUri(): string {
  return `${window.location.origin}/auth/line/callback`
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
