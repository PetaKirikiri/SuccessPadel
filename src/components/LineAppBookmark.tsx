import { useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import {
  dismissLineBookmarkPrompt,
  lineBookmarkUrl,
  markLineBookmarkSaved,
} from '../lib/line/bookmark'

type Props = {
  variant?: 'banner' | 'card'
  onDone?: () => void
}

export function LineAppBookmark({ variant = 'card', onDone }: Props) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const url = lineBookmarkUrl('/friendly')

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      markLineBookmarkSaved()
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t('common.copyBrowserLinkPrompt'), url)
    }
  }

  const shell =
    variant === 'banner'
      ? 'rounded-xl border border-brand-border bg-brand-surface p-3'
      : 'rounded-xl border border-brand-border bg-brand-surface p-4'

  return (
    <div className={shell}>
      <p className="text-sm font-semibold text-brand-primary">{t('profile.bookmarkTitle')}</p>
      <p className="mt-1 text-xs text-brand-muted">{t('profile.bookmarkHint')}</p>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="mt-2 w-full brand-btn py-2 text-sm font-semibold"
      >
        {copied ? t('lineLink.copied') : t('lineLink.copyBrowserLink')}
      </button>
      {variant === 'banner' ? (
        <button
          type="button"
          onClick={() => {
            dismissLineBookmarkPrompt()
            onDone?.()
          }}
          className="mt-2 text-xs text-brand-muted underline"
        >
          {t('profile.gotIt')}
        </button>
      ) : null}
    </div>
  )
}
