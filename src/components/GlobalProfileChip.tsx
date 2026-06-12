import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { LanguagePicker } from './LanguagePicker'
import { ProfileChip } from './ProfileChip'

export function GlobalProfileChip() {
  const loc = useLocation()
  const { t } = useTranslation()
  const { loading: authLoading } = useAuth()
  const returnTo =
    loc.pathname && loc.pathname !== '/login' && !loc.pathname.startsWith('/auth/')
      ? `${loc.pathname}${loc.search}`
      : undefined

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[150] px-3 md:px-6">
      <div className="mx-auto flex w-full max-w-full justify-end md:max-w-3xl lg:max-w-4xl">
        <div className="pointer-events-auto flex flex-row flex-nowrap items-center gap-2 md:gap-3" dir="ltr">
          <Link
            to="/practice"
            className="shrink-0 rounded-full border border-brand-border/70 bg-brand-surface/95 px-2.5 py-1.5 text-[11px] font-semibold text-brand-primary shadow-sm backdrop-blur-sm transition active:opacity-80 md:px-3 md:text-xs"
          >
            {t('practice.courtButton')}
          </Link>
          <LanguagePicker />
          {!authLoading && <ProfileChip returnTo={returnTo} className="shrink-0" />}
        </div>
      </div>
    </div>
  )
}
