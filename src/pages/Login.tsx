import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LineSigningInScreen } from '../components/LineSigningInScreen'
import { saveReturnTo } from '../lib/authReturnTo'
import { isLineLiffBrowser } from '../lib/line/liff'
import { linkTokenFromLocation } from '../lib/line/playerLink'
import { lineOAuthCallbackCode } from '../lib/line/oauth'

/** OAuth callback only — never show a welcome / sign-in screen. */
export function Login() {
  const location = useLocation()
  const loginState = (location.state as { from?: string } | null) ?? {}
  const fromPath = loginState.from
  const searchParams = new URLSearchParams(location.search)
  const playerLinkEntry = Boolean(linkTokenFromLocation(location.search))
  const linkState = searchParams.get('state')
  const isPlayerLinkReturn = Boolean(linkState?.startsWith('lpl_'))
  const oauthReturning =
    Boolean(lineOAuthCallbackCode(location.search)) || isPlayerLinkReturn
  const inLineBrowser = isLineLiffBrowser()

  useEffect(() => {
    if (fromPath) saveReturnTo(fromPath)
  }, [fromPath])

  if (playerLinkEntry) return null

  if (inLineBrowser) {
    return <LineSigningInScreen message="Signing in with LINE…" />
  }

  if (oauthReturning) return null

  return <Navigate to="/friendly" replace />
}
