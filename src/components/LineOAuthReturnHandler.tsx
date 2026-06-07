import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { consumeReturnTo } from '../lib/authReturnTo'
import { completeLineOAuthFromUrl, lineOAuthCallbackCode } from '../lib/line/oauth'
import { LineLinkReturnFlow } from './LineLinkReturnFlow'
import { LineSigningInScreen } from './LineSigningInScreen'

/** Finish browser LINE Login when LINE redirects back with ?code= */
export function LineOAuthReturnHandler() {
  const { t } = useTranslation()
  const { search } = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const hasCode = Boolean(lineOAuthCallbackCode(search))
  const linkState = new URLSearchParams(search).get('state')
  const isPlayerLink = Boolean(linkState?.startsWith('lpl_'))

  useEffect(() => {
    if (!hasCode || isPlayerLink) return

    let active = true
    void (async () => {
      const err = await completeLineOAuthFromUrl(search)
      if (!active) return
      if (err) {
        setError(err)
        navigate('/login', { replace: true, state: { lineError: err } })
        return
      }
      navigate(consumeReturnTo('/'), { replace: true })
    })()

    return () => {
      active = false
    }
  }, [hasCode, isPlayerLink, search, navigate])

  if (hasCode && isPlayerLink) {
    return (
      <div className="fixed inset-0 z-[100]">
        <LineLinkReturnFlow search={search} />
      </div>
    )
  }

  if (!hasCode) return null
  if (error) return null

  return <LineSigningInScreen message={t('lineLink.signingInLine')} />
}
