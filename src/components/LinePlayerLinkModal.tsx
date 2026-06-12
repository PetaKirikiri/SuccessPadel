import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../hooks/useTranslation'
import {
  createLinePlayerLinkRequest,
  getCachedLinePlayerLinkRequest,
  type LinePlayerLinkRequest,
} from '../lib/line/playerLink'
import { LineSignUpQr } from './LineSignUpQr'

const LINE_ADD_FRIEND_GUIDE_SRC = '/assets/line-add-friend-guide.png'

type Props = {
  competitionId: string | null
  padelPlayerId: string
  playerName: string
  onClose: () => void
}

function LinkStep({
  n,
  prefix,
  bold,
  suffix,
}: {
  n: number
  prefix: string
  bold: string
  suffix: string
}) {
  return (
    <li>
      <span className="font-semibold text-brand-text">{n}.</span> {prefix}
      <span className="font-medium text-brand-text">{bold}</span>
      {suffix}
    </li>
  )
}

export function LinePlayerLinkModal({
  competitionId,
  padelPlayerId,
  playerName,
  onClose,
}: Props) {
  const { t } = useTranslation()
  const [request, setRequest] = useState<LinePlayerLinkRequest | null>(
    () => getCachedLinePlayerLinkRequest(padelPlayerId),
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !getCachedLinePlayerLinkRequest(padelPlayerId))
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const cached = getCachedLinePlayerLinkRequest(padelPlayerId)
    if (cached) {
      setRequest(cached)
      setLoading(false)
      setError(null)
      return
    }

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
        setError(err ?? t('lineLink.couldNotStart'))
        setRequest(null)
      } else {
        setRequest(req)
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [competitionId, padelPlayerId, attempt, t])

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        data-scroll-y
        className="login-panel scroll-y max-h-[94vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-brand-surface p-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-base font-semibold text-brand-primary">
            {t('lineLink.title', { name: playerName })}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
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
              {t('common.tryAgain')}
            </button>
          </div>
        ) : request ? (
          <>
            <div className="rounded-xl border-2 border-[#06C755] bg-[#06C755]/10 px-4 py-3 text-left">
              <p className="font-display text-lg font-bold leading-snug text-brand-primary md:text-xl">
                {t('lineLink.scanQrHeadline')}
              </p>
              <p className="mt-1.5 text-sm font-medium leading-snug text-brand-text">
                {t('lineLink.scanQrSubhead')}
              </p>
            </div>
            <div className="grid grid-cols-2 items-center gap-3">
              <div className="space-y-2">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-[#06C755]">
                  {t('lineLink.scanQrLabel')}
                </p>
                <LineSignUpQr url={request.qrUrl} onDataUrl={setQrDataUrl} />
                {qrDataUrl ? (
                  <a
                    href={qrDataUrl}
                    download={`${playerName.trim() || 'player'}-line-qr.png`}
                    className="brand-btn-outline block w-full py-2 text-sm font-semibold"
                  >
                    {t('lineLink.saveQr')}
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
            <ol className="space-y-1.5 text-left text-xs text-brand-muted">
              <LinkStep
                n={1}
                prefix={t('lineLink.step1Prefix')}
                bold={t('lineLink.step1Bold')}
                suffix={t('lineLink.step1Suffix')}
              />
              <LinkStep
                n={2}
                prefix={t('lineLink.step2Prefix')}
                bold={t('lineLink.step2Bold')}
                suffix={t('lineLink.step2Suffix')}
              />
              <LinkStep
                n={3}
                prefix={t('lineLink.step3Prefix')}
                bold={t('lineLink.step3Bold')}
                suffix={t('lineLink.step3Suffix')}
              />
              <LinkStep
                n={4}
                prefix={t('lineLink.step4Prefix')}
                bold={t('lineLink.step4Bold')}
                suffix={t('lineLink.step4Suffix')}
              />
            </ol>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
