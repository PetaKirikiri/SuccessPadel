import { useState } from 'react'
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
  const [copied, setCopied] = useState(false)
  const url = lineBookmarkUrl('/login')

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      markLineBookmarkSaved()
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  const shell =
    variant === 'banner'
      ? 'rounded-xl border border-brand-border bg-brand-surface p-3'
      : 'rounded-xl border border-brand-border bg-brand-surface p-4'

  return (
    <div className={shell}>
      <p className="text-sm font-semibold text-brand-primary">Bookmark in your browser</p>
      <p className="mt-1 text-xs text-brand-muted">
        Save this link in Safari — not inside LINE. From a LINE chat, long-press the link and choose
        Open in Safari.
      </p>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="mt-2 w-full brand-btn py-2 text-sm font-semibold"
      >
        {copied ? 'Link copied!' : 'Copy browser link'}
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
          Got it
        </button>
      ) : null}
    </div>
  )
}
