import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { isLineLiffBrowser } from '../lib/line/liff'
import { beginLineLinkOAuth, finishLineLinkOAuth } from '../lib/line/linkOAuthGuard'
import {
  completeLinePlayerLinkFromUrl,
  consumeLineHandoffToken,
  lineHandoffCompleteUrl,
  resolveCompetitionPathAfterLink,
} from '../lib/line/playerLink'
import { isNativeApp } from '../lib/native/app'
import { LineSigningInScreen } from './LineSigningInScreen'

type Props = {
  search: string
}

export function LineLinkReturnFlow({ search }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const copyHandoff = async () => {
    if (!handoffUrl) return
    try {
      await navigator.clipboard.writeText(handoffUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t('common.copyLinkPrompt'), handoffUrl)
    }
  }

  useEffect(() => {
    const oauthCode = beginLineLinkOAuth(search)
    if (!oauthCode) return

    let active = true

    void (async () => {
      let succeeded = false
      try {
        const { result, error: linkErr } = await completeLinePlayerLinkFromUrl(search)

        if (linkErr || !result) {
          if (active) setError(linkErr ?? t('lineLink.linkingFailed'))
          return
        }

        const finishInBrowser = isNativeApp() || !isLineLiffBrowser()
        if (finishInBrowser) {
          const { competitionId, error: handoffErr } = await consumeLineHandoffToken(
            result.handoffToken,
          )
          if (handoffErr) {
            if (active) setError(handoffErr)
            return
          }
          succeeded = true
          navigate(
            resolveCompetitionPathAfterLink(competitionId ?? result.competitionId, search),
            { replace: true },
          )
          return
        }

        if (active) setHandoffUrl(lineHandoffCompleteUrl(result.handoffToken))
        succeeded = true
      } finally {
        finishLineLinkOAuth(oauthCode, succeeded)
      }
    })()

    return () => {
      active = false
    }
  }, [search, navigate, t])

  if (error) {
    return (
      <div className="game-bg flex h-full min-h-0 w-full items-center justify-center px-4">
        <div className="login-panel max-w-sm space-y-3 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-brand-muted">{t('lineLink.safariHint')}</p>
          <Link to="/" className="brand-link text-sm">
            {t('lineLink.backToApp')}
          </Link>
        </div>
      </div>
    )
  }

  if (handoffUrl) {
    return (
      <div className="game-bg flex h-full min-h-0 w-full items-center justify-center px-4">
        <div className="login-panel max-w-sm space-y-4 text-center">
          <p className="font-display text-lg font-semibold text-brand-primary">
            {t('lineLink.accountLinked')}
          </p>
          <p className="text-sm text-brand-muted">{t('lineLink.accountLinkedHint')}</p>
          <a
            href={handoffUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="brand-btn block w-full py-3 text-base font-semibold"
          >
            {t('lineLink.openInBrowser')}
          </a>
          <button
            type="button"
            onClick={() => void copyHandoff()}
            className="w-full break-all text-xs text-brand-muted underline"
          >
            {copied ? t('lineLink.copied') : t('lineLink.copyHandoff')}
          </button>
        </div>
      </div>
    )
  }

  return <LineSigningInScreen message={t('lineLink.linkingAccount')} />
}
