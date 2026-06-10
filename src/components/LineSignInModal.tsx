import { useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../hooks/useTranslation'
import { hadPreviousLogin } from '../lib/auth/cachedSession'
import { isLineLoginConfigured } from '../lib/line/auth'
import { lineAppEntryUrl } from '../lib/line/liff'
import { supabase } from '../lib/supabaseClient'
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

export function LineSignInModal({ onClose }: Props) {
  const { t } = useTranslation()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const qrUrl = useMemo(() => lineAppEntryUrl('/friendly'), [])
  const lineEnabled = isLineLoginConfigured()
  const returning = hadPreviousLogin()

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    setEmailBusy(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setEmailError(signInError.message)
        return
      }
      const { data: confirmed } = await supabase.auth.getSession()
      if (!confirmed.session?.user) {
        setEmailError('Sign-in did not stick — try again.')
        return
      }
      onClose()
    } finally {
      setEmailBusy(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        data-scroll-y
        className="login-panel scroll-y min-h-0 w-full max-w-lg space-y-4 overflow-y-auto overscroll-contain rounded-2xl bg-brand-surface p-5 text-center max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem)] sm:max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
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
        ) : !qrUrl ? (
          <p className="text-sm text-red-600">{t('signInModal.notConfigured')}</p>
        ) : (
          <div>
            {returning ? (
              <p className="mb-3 text-left text-sm text-brand-muted">{t('signInModal.returningHint')}</p>
            ) : null}
            <p className="mb-3 text-left font-display text-sm font-semibold text-brand-primary">
              {t('signInModal.scanQrHeadline')}
            </p>
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
                      className="h-auto max-h-[24vh] w-full rounded-2xl border border-brand-border object-contain sm:max-h-[32vh]"
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
          </div>
        )}

        <div className="border-t border-brand-border/60 pt-4">
          <p className="mb-3 text-left text-xs font-semibold uppercase tracking-wide text-brand-muted">
            {t('signInModal.emailSectionTitle')}
          </p>
          <form className="space-y-3 text-left" onSubmit={(e) => void handleEmailSignIn(e)}>
            <label className="block space-y-1">
              <span className="text-xs text-brand-muted">{t('signInModal.emailLabel')}</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="brand-input"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-brand-muted">{t('signInModal.passwordLabel')}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="brand-input"
                required
              />
            </label>
            <button type="submit" disabled={emailBusy} className="brand-btn w-full disabled:opacity-60">
              {emailBusy ? t('signInModal.emailSigningIn') : t('signInModal.emailSignIn')}
            </button>
            {emailError ? <p className="text-sm text-red-600">{emailError}</p> : null}
          </form>
        </div>
      </div>
    </div>,
    document.body,
  )
}
