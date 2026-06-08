import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../hooks/useTranslation'
import { hadPreviousLogin } from '../lib/auth/cachedSession'
import { isLineLoginConfigured, startLineLogin } from '../lib/line/auth'
import { lineAppEntryUrl } from '../lib/line/liff'
import { LineSignUpQr } from './LineSignUpQr'

const LINE_ADD_FRIEND_GUIDE_SRC = '/assets/line-add-friend-guide.png'

type Props = {
  returnTo?: string
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

export function LineSignInModal({ returnTo, onClose }: Props) {
  const { t } = useTranslation()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [lineBusy, setLineBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const qrUrl = useMemo(() => lineAppEntryUrl('/login'), [])
  const lineEnabled = isLineLoginConfigured()
  const returning = hadPreviousLogin()

  const handleContinueLine = async () => {
    setError(null)
    setLineBusy(true)
    let redirected = false
    try {
      const result = await startLineLogin(returnTo ?? window.location.pathname)
      redirected = result.redirected
      if (result.redirected) {
        window.setTimeout(() => setLineBusy(false), 5000)
        return
      }
      if (result.error) setError(result.error)
      else onClose()
    } finally {
      if (!redirected) setLineBusy(false)
    }
  }

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
            {returning ? t('signInModal.welcomeBack') : t('signInModal.title')}
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

        {!lineEnabled ? (
          <p className="text-sm text-red-600">{t('signInModal.notConfigured')}</p>
        ) : (
          <>
            <p className="text-left text-sm text-brand-muted">
              {returning ? t('signInModal.returningHint') : t('login.pitch')}
            </p>
            <button
              type="button"
              disabled={lineBusy}
              onClick={() => void handleContinueLine()}
              className="w-full rounded-xl bg-[#06C755] px-8 py-3 text-base font-semibold text-white disabled:opacity-60"
            >
              {lineBusy ? t('login.openingLine') : t('login.continueLine')}
            </button>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="border-t border-brand-border/60 pt-4">
              <p className="mb-3 text-left text-xs font-semibold uppercase tracking-wide text-brand-muted">
                {t('signInModal.qrSectionTitle')}
              </p>
              {!qrUrl ? (
                <p className="text-sm text-red-600">{t('signInModal.notConfigured')}</p>
              ) : (
                <>
                  <div className="rounded-xl border border-brand-border bg-brand-bg-alt/40 px-4 py-3 text-left">
                    <p className="text-sm font-medium leading-snug text-brand-text">
                      {t('signInModal.scanQrSubhead')}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 items-center gap-3">
                    <div className="space-y-2">
                      <p className="font-display text-sm font-bold uppercase tracking-wide text-[#06C755]">
                        {t('lineLink.scanQrLabel')}
                      </p>
                      <LineSignUpQr url={qrUrl} onDataUrl={setQrDataUrl} />
                      {qrDataUrl ? (
                        <a
                          href={qrDataUrl}
                          download="success-padel-sign-in-line-qr.png"
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
                      className="h-auto max-h-[40vh] w-full rounded-2xl border border-brand-border object-contain"
                    />
                  </div>
                  <ol className="mt-3 space-y-1.5 text-left text-xs text-brand-muted">
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
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
