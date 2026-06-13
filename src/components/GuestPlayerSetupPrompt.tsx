import { Share2 } from 'lucide-react'
import { LineLogoIcon } from './LineLogoIcon'
import type { TranslateFn } from '../i18n'

type Props = {
  canConnectLine: boolean
  onConnectLine?: () => void
  canShareProfile: boolean
  onShareProfile?: () => void
  shareFeedback?: string | null
  t: TranslateFn
}

export function GuestPlayerSetupPrompt({
  canConnectLine,
  onConnectLine,
  canShareProfile,
  onShareProfile,
  shareFeedback,
  t,
}: Props) {
  return (
    <section className="border-t border-brand-border/60 px-4 py-5 md:px-5">
      <p className="text-sm leading-relaxed text-brand-text">{t('playerProfile.shareProfileMessage')}</p>
      <div className="mt-4 flex flex-col gap-2">
        {canConnectLine && onConnectLine ? (
          <button
            type="button"
            onClick={onConnectLine}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-bg-alt px-4 py-3 text-sm font-semibold text-brand-primary shadow-sm active:scale-[0.98]"
          >
            <LineLogoIcon className="h-5 w-5" />
            {t('playerProfile.connectLine')}
          </button>
        ) : null}
        {canShareProfile && onShareProfile ? (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={onShareProfile}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm font-semibold text-brand-primary shadow-sm active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              {t('playerProfile.shareProfile')}
            </button>
            {shareFeedback ? (
              <p className="text-center text-[10px] font-medium text-brand-muted">{shareFeedback}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
