import { useTranslation } from '../hooks/useTranslation'
import {
  BALL_PATH_OUTCOME_DEFS,
  PRACTICE_RALLY_OUTCOMES,
  PRACTICE_SERVE_OUTCOMES,
  SERVE_LANDING_DEFS,
} from '../lib/pointOutcomes'

/** Legend for the practice court — maps to centralized outcome logic. */
export function PracticeOutcomeKey() {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none flex max-w-[14rem] flex-col gap-1 rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[9px] leading-tight text-white/85 backdrop-blur-sm sm:max-w-[16rem] sm:text-[10px]">
      <span className="text-[8px] font-bold uppercase tracking-wider text-white/55 sm:text-[9px]">
        {t('practice.legendTitle')}
      </span>
      <span className="font-semibold text-white/70">{t('practice.legendServe')}</span>
      {PRACTICE_SERVE_OUTCOMES.map((landing) => {
        const def = SERVE_LANDING_DEFS[landing]
        return (
          <span key={landing} className="pl-1 text-white/80">
            · {t(def.labelKey)}
          </span>
        )
      })}
      <span className="mt-0.5 font-semibold text-white/70">{t('practice.legendRally')}</span>
      {PRACTICE_RALLY_OUTCOMES.map((outcome) => {
        const def = BALL_PATH_OUTCOME_DEFS[outcome]
        return (
          <span key={outcome} className="pl-1 text-white/80">
            · {t(def.labelKey)}
          </span>
        )
      })}
    </div>
  )
}
