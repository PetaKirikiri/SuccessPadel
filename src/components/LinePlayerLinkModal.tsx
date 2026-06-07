import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  createLinePlayerLinkRequest,
  type LinePlayerLinkRequest,
} from '../lib/line/playerLink'
import { LineSignUpQr } from './LineSignUpQr'

type Props = {
  competitionId: string | null
  padelPlayerId: string
  playerName: string
  onClose: () => void
}

export function LinePlayerLinkModal({
  competitionId,
  padelPlayerId,
  playerName,
  onClose,
}: Props) {
  const [request, setRequest] = useState<LinePlayerLinkRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void (async () => {
      const { request: req, error: err } = await createLinePlayerLinkRequest(
        competitionId,
        padelPlayerId,
      )
      if (!active) return
      if (err || !req) {
        setError(err ?? 'Could not start linking')
      } else {
        setRequest(req)
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [competitionId, padelPlayerId, attempt])

  const copyUrl = async () => {
    if (!request) return
    try {
      await navigator.clipboard.writeText(request.qrUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', request.qrUrl)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="login-panel w-full max-w-sm space-y-4 rounded-2xl bg-brand-surface p-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-base font-semibold text-brand-primary">
            Add LINE to {playerName}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-lg leading-none text-brand-muted"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="mx-auto h-[280px] w-[280px] max-w-full animate-pulse rounded-2xl bg-brand-border" />
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="brand-btn w-full py-2 text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        ) : request ? (
          <div className="space-y-3">
            <p className="text-xs text-brand-muted">Scan with LINE (Home → QR code)</p>
            <LineSignUpQr url={request.qrUrl} />
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="brand-btn-outline w-full py-2 text-sm font-semibold"
            >
              {copied ? 'Link copied!' : 'Copy link'}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
