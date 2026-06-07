import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createLinePlayerLinkRequest, type LinePlayerLinkRequest } from '../lib/line/playerLink'
import { LineSignUpQr } from './LineSignUpQr'

const LINE_ADD_FRIEND_GUIDE_SRC = '/assets/line-add-friend-guide.png'

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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setQrDataUrl(null)
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

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="login-panel max-h-[94vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-brand-surface p-5 text-center"
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
          <div className="grid grid-cols-2 items-center gap-3">
            <div className="space-y-2">
              <LineSignUpQr url={request.qrUrl} onDataUrl={setQrDataUrl} />
              {qrDataUrl ? (
                <a
                  href={qrDataUrl}
                  download={`${playerName.trim() || 'player'}-line-qr.png`}
                  className="brand-btn-outline block w-full py-2 text-sm font-semibold"
                >
                  Save QR code
                </a>
              ) : null}
            </div>
            <img
              src={LINE_ADD_FRIEND_GUIDE_SRC}
              alt=""
              aria-hidden
              className="h-auto max-h-[78vh] w-full rounded-2xl border border-brand-border object-contain"
            />
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
