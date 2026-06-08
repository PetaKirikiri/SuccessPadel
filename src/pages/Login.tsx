import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppTopBar } from '../components/AppTopBar'
import { LineNativeLoginPanel } from '../components/LineNativeLoginPanel'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { consumeReturnTo, saveReturnTo } from '../lib/authReturnTo'
import { isLineLoginConfigured, startLineLogin } from '../lib/line/auth'
import { linkTokenFromLocation } from '../lib/line/playerLink'
import { lineOAuthCallbackCode } from '../lib/line/oauth'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const { session, loading } = useAuth()
  const loginState = (location.state as { from?: string } | null) ?? {}
  const fromPath = loginState.from
  const searchParams = new URLSearchParams(location.search)
  const lineEnabled = isLineLoginConfigured()
  const playerLinkEntry = Boolean(linkTokenFromLocation(location.search))
  const [error, setError] = useState<string | null>(null)
  const [lineBusy, setLineBusy] = useState(false)
  const linkState = searchParams.get('state')
  const isPlayerLinkReturn = Boolean(linkState?.startsWith('lpl_'))
  const oauthReturning =
    Boolean(lineOAuthCallbackCode(location.search)) || isPlayerLinkReturn

  useEffect(() => {
    if (fromPath) saveReturnTo(fromPath)
  }, [fromPath])

  useEffect(() => {
    const lineError = (location.state as { lineError?: string } | null)?.lineError
    if (lineError) setError(lineError)
  }, [location.state])

  useEffect(() => {
    if (!loading && session && !oauthReturning) {
      navigate(fromPath ?? consumeReturnTo('/'), { replace: true })
    }
  }, [loading, session, fromPath, navigate, oauthReturning])

  const goAfterAuth = () => {
    navigate(fromPath ?? consumeReturnTo('/'), { replace: true })
  }

  const handleLineLogin = async () => {
    setError(null)
    setLineBusy(true)
    let redirected = false
    try {
      const returnPath = fromPath ?? consumeReturnTo('/login')
      const result = await startLineLogin(returnPath)
      redirected = result.redirected
      if (result.redirected) {
        window.setTimeout(() => setLineBusy(false), 5000)
        return
      }
      if (result.error) setError(result.error)
      else goAfterAuth()
    } finally {
      if (!redirected) setLineBusy(false)
    }
  }

  if (oauthReturning || playerLinkEntry) return null

  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <AppTopBar className="py-3">
        <img
          src="/brand/logo-padel.webp"
          alt={t('common.brandAlt')}
          className="h-8 w-auto max-w-[7rem] shrink-0"
        />
      </AppTopBar>
      <div className="login-panel mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        {!lineEnabled && (
          <p className="mb-6 text-center text-sm text-red-600">{t('login.lineNotConfigured')}</p>
        )}
        <LineNativeLoginPanel busy={lineBusy} onContinue={() => void handleLineLogin()} />
        {error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
