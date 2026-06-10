import { useTranslation } from '../hooks/useTranslation'

type Props = {
  label: string
  hint?: string
  /** confirm = swipe yes/no · steps = multi-stroke shot in progress */
  variant?: 'confirm' | 'steps'
  stepNote?: string
}

export function ShotConfirmOverlay({
  label,
  hint,
  variant = 'confirm',
  stepNote,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[5] flex justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/35 bg-black/75 px-5 py-3 text-center shadow-lg backdrop-blur-md">
        {hint ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">{hint}</p>
        ) : null}
        <p className={`font-display text-xl font-bold text-amber-200${hint ? ' mt-1' : ''}`}>
          {label}
        </p>
        {variant === 'steps' ? (
          <>
            {stepNote ? (
              <p className="mt-2 text-sm font-semibold text-white/90">{stepNote}</p>
            ) : null}
            <p className="mt-1.5 text-xs font-semibold tracking-wide text-white/75">
              <span className="text-emerald-300">{t('pad.confirm.winner')}</span>
              <span className="mx-2 text-white/40">·</span>
              <span className="text-rose-300">{t('pad.confirm.notWinner')}</span>
            </p>
            <p className="mt-1 text-[10px] font-medium text-white/45">
              {t('pad.confirm.horizontalNote')}
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-xs font-semibold tracking-wide text-white/75">
            <span className="text-rose-300">{t('pad.confirm.flickNo')}</span>
            <span className="mx-2 text-white/40">·</span>
            <span className="text-emerald-300">{t('pad.confirm.flickYes')}</span>
          </p>
        )}
      </div>
    </div>
  )
}
