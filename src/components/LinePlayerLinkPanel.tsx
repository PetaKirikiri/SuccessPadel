import { useTranslation } from '../hooks/useTranslation'
import { useLinePlayerLinkRequest } from '../hooks/useLinePlayerLinkRequest'
import { LineLogoIcon } from './LineLogoIcon'
import { LineSignUpQr } from './LineSignUpQr'

const LINE_ADD_FRIEND_GUIDE_SRC = '/assets/line-add-friend-guide.png'

type Props = {
  competitionId: string | null
  padelPlayerId: string
  playerName: string
  onClose?: () => void
  embedded?: boolean
}

function LinkStep({
  n,
  children,
  aside,
}: {
  n: number
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-brand-border/50 bg-brand-bg-alt/40 p-3.5">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#06C755] text-xs font-bold text-white"
        aria-hidden
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm leading-snug text-brand-text">{children}</p>
        {aside}
      </div>
    </li>
  )
}

export function LinePlayerLinkPanel({
  competitionId,
  padelPlayerId,
  playerName,
  onClose,
  embedded = false,
}: Props) {
  const { t } = useTranslation()
  const { request, error, loading, qrDataUrl, setQrDataUrl, retry } =
    useLinePlayerLinkRequest(competitionId, padelPlayerId)

  const body = (
    <>
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-[280px] w-[280px] max-w-full animate-pulse rounded-2xl bg-brand-border" />
          <p className="text-sm text-brand-muted">{t('lineLink.oneMoment')}</p>
        </div>
      ) : error ? (
        <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-center">
          <p className="text-sm text-red-600">{error ?? t('lineLink.couldNotStart')}</p>
          <button
            type="button"
            onClick={retry}
            className="text-sm font-medium text-brand-accent underline"
          >
            {t('common.tryAgain')}
          </button>
        </div>
      ) : request ? (
        <div className="space-y-5">
          <div className="flex flex-col items-center">
            <p className="mb-3 text-center text-sm font-medium text-brand-text">
              {t('lineLink.scanQrHeadline')}
            </p>
            <div className="rounded-2xl border border-brand-border/60 bg-white p-3 shadow-sm">
              <LineSignUpQr url={request.qrUrl} onDataUrl={setQrDataUrl} />
            </div>
            {qrDataUrl ? (
              <a
                href={qrDataUrl}
                download={`${playerName.trim() || 'player'}-line-qr.png`}
                className="mt-3 inline-flex rounded-full bg-[#06C755] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#05b34c]"
              >
                {t('lineLink.saveQr')}
              </a>
            ) : null}
          </div>

          <ol className="space-y-2.5 text-left" aria-label={t('lineLink.scanQrLabel')}>
            <LinkStep n={1}>
              {t('lineLink.step1Prefix')}
              <strong>{t('lineLink.step1Bold')}</strong>
              {t('lineLink.step1Suffix')}
            </LinkStep>
            <LinkStep n={2}>
              {t('lineLink.step2Prefix')}
              <strong className="inline-flex items-center gap-1">
                <LineLogoIcon className="h-3.5 w-3.5" />
                {t('lineLink.step2Bold')}
              </strong>
              {t('lineLink.step2Suffix')}
            </LinkStep>
            <LinkStep
              n={3}
              aside={
                <figure className="overflow-hidden rounded-lg border border-brand-border/40 bg-white">
                  <img
                    src={LINE_ADD_FRIEND_GUIDE_SRC}
                    alt=""
                    className="h-auto max-h-28 w-full object-contain object-left-top"
                  />
                </figure>
              }
            >
              {t('lineLink.step3Prefix')}
              <strong>{t('lineLink.step3Bold')}</strong>
              {t('lineLink.step3SuffixGuide')}
            </LinkStep>
            <LinkStep n={4}>
              {t('lineLink.step4Prefix')}
              <strong>{t('lineLink.step4Bold')}</strong>
              {t('lineLink.step4Suffix')}
            </LinkStep>
          </ol>
        </div>
      ) : null}
    </>
  )

  if (embedded) {
    return (
      <div className="px-4 py-3 md:px-5">
        <section className="rounded-xl border border-brand-border bg-[#f8f7f5] p-3 shadow-sm">
          <h3 className="mb-2.5 flex items-start gap-2 border-b border-brand-border/70 pb-2">
            <LineLogoIcon className="mt-0.5 h-6 w-6 shrink-0" />
            <div className="min-w-0 text-left">
              <p className="font-display text-sm font-semibold text-brand-primary">
                {t('lineLink.title', { name: playerName })}
              </p>
              <p className="mt-0.5 text-xs font-normal normal-case tracking-normal text-brand-muted">
                {t('lineLink.scanQrSubhead')}
              </p>
            </div>
          </h3>
          {body}
        </section>
      </div>
    )
  }

  return (
    <>
      <header className="flex shrink-0 items-start gap-3 border-b border-brand-border/40 px-4 py-4">
        <LineLogoIcon className="mt-0.5 h-8 w-8 shrink-0" />
        <div className="min-w-0 flex-1 text-left">
          <p className="font-display text-base font-semibold leading-snug text-brand-primary">
            {t('lineLink.title', { name: playerName })}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-brand-muted">
            {t('lineLink.scanQrSubhead')}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-brand-muted transition hover:bg-brand-bg-alt hover:text-brand-text"
          >
            ✕
          </button>
        ) : null}
      </header>

      <div className="px-4 py-4">{body}</div>
    </>
  )
}
