import { useTranslation } from '../hooks/useTranslation'

type Props = {
  onCancel: () => void
  onAccept: () => void
}

export function BallPathConfirmBar({ onCancel, onAccept }: Props) {
  const { t } = useTranslation()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[8] flex items-center justify-between px-5">
      <p className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold text-white/45">
        {t('pad.confirm.swipeHint')}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="pointer-events-auto rounded-xl border border-rose-400/60 bg-rose-950/80 px-5 py-2.5 text-sm font-bold text-rose-200 shadow-lg active:scale-95"
      >
        {t('pad.confirm.cancel')}
      </button>
      <button
        type="button"
        onClick={onAccept}
        className="pointer-events-auto rounded-xl border border-emerald-400/60 bg-emerald-950/80 px-5 py-2.5 text-sm font-bold text-emerald-200 shadow-lg active:scale-95"
      >
        {t('pad.confirm.accept')}
      </button>
    </div>
  )
}
