import { useState } from 'react'
import { LineSignUpQr } from './LineSignUpQr'

type Props = {
  url: string
}

function LineLogo() {
  return (
    <svg viewBox="0 0 88 28" aria-label="LINE" className="h-7 w-auto" role="img">
      <rect width="88" height="28" rx="6" fill="#06C755" />
      <text
        x="44"
        y="19"
        fill="#fff"
        fontSize="14"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        textAnchor="middle"
      >
        LINE
      </text>
    </svg>
  )
}

export function LineSignUpHandoff({ url }: Props) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator.share === 'function'

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  const shareLink = async () => {
    if (!canShare) {
      await copyLink()
      return
    }
    try {
      await navigator.share({ title: 'Success Padel — sign up', url })
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-10">
      <img
        src="/brand/logo-padel.webp"
        alt="Success Padel"
        className="h-16 w-auto max-w-[min(100%,12rem)]"
      />
      <LineLogo />
      <LineSignUpQr url={url} />
      <p className="max-w-xs text-center text-sm text-brand-muted">
        On your phone: open <strong>LINE</strong> → scan this QR (or tap the link). Login only works
        inside the LINE app — not Safari.
      </p>
      <div className="grid w-full grid-cols-2 gap-2">
        <button type="button" onClick={() => void copyLink()} className="brand-btn py-2.5 text-sm font-semibold">
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <button type="button" onClick={() => void shareLink()} className="brand-btn py-2.5 text-sm font-semibold">
          {canShare ? 'Share…' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}
