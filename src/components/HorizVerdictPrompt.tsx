import { useTranslation } from '../hooks/useTranslation'

type Props = {
  label: string
}

export function HorizVerdictPrompt({ label }: Props) {
  const { t } = useTranslation()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[6] flex justify-center px-4">
      <div className="rounded-xl border border-white/25 bg-black/75 px-4 py-2.5 text-center shadow-lg backdrop-blur-sm">
        <p className="text-sm font-semibold text-amber-200">{label}</p>
        <p className="mt-1.5 text-xs font-semibold tracking-wide">
          <span className="text-emerald-300">{t('pad.horiz.win')}</span>
          <span className="mx-2 text-white/35">·</span>
          <span className="text-rose-300">{t('pad.horiz.foul')}</span>
        </p>
        <p className="mt-1 text-[10px] font-medium text-white/50">{t('pad.horiz.drawHint')}</p>
      </div>
    </div>
  )
}
