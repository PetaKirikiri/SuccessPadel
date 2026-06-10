import type { ReactNode } from 'react'

export const WIZARD_BTN =
  'w-full rounded-lg border border-white/35 bg-black/25 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/40 active:scale-[0.98]'

export const WIZARD_PRIMARY_BTN =
  'w-full rounded-lg border border-white/50 bg-white/80 px-4 py-3 text-sm font-semibold text-[#11355c] backdrop-blur-sm transition hover:bg-white active:scale-[0.98]'

const WIZARD_TITLE =
  'w-full text-center text-base font-semibold leading-snug text-white sm:text-lg'

const WIZARD_SUBTITLE =
  'w-full text-center text-sm font-medium leading-snug text-white/80 sm:text-base'

type Props = {
  interactive?: boolean
  message?: string
  title?: string
  subtitle?: string
  children?: ReactNode
}

export function GesturePadSetupWizard({
  interactive = false,
  message,
  title,
  subtitle,
  children,
}: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/2 z-[30] flex -translate-y-1/2 justify-center px-3 sm:px-5">
      <div
        className={`flex w-[min(94vw,42rem)] flex-col items-center gap-5 rounded-2xl border border-white/15 bg-black/10 px-7 py-7 backdrop-blur-[2px] sm:gap-6 sm:px-11 sm:py-9 ${
          interactive ? 'pointer-events-auto' : ''
        }`}
      >
        {message ? <p className={WIZARD_TITLE}>{message}</p> : null}
        {title || subtitle ? (
          <div className="flex w-full flex-col gap-1">
            {title ? <p className={WIZARD_TITLE}>{title}</p> : null}
            {subtitle ? <p className={WIZARD_SUBTITLE}>{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
