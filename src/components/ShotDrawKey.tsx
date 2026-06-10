import { useTranslation } from '../hooks/useTranslation'

/** Compact guide shown in the top margin while drawing a rally shot. */
export function ShotDrawKey() {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none flex max-w-[18rem] flex-col gap-0.5 rounded-lg border border-white/15 bg-black/45 px-2 py-1.5 text-[9px] font-semibold leading-tight text-white/85 backdrop-blur-sm sm:text-[10px]">
      <span className="text-[8px] font-bold uppercase tracking-wider text-white/55 sm:text-[9px]">
        {t('pad.drawKey.title')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-sm bg-emerald-400" />
        {t('pad.drawKey.score')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-sm bg-rose-500" />
        {t('pad.drawKey.foul')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-sm bg-rose-500" />
        {t('pad.drawKey.net')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="shrink-0 text-white/55">↗</span>
        {t('pad.drawKey.out')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="shrink-0 text-white/55">⏸</span>
        {t('pad.drawKey.glass')}
      </span>
    </div>
  )
}
