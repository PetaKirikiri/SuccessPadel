import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LanguagePicker } from './LanguagePicker'
import { ProfileChip } from './ProfileChip'

export function GlobalProfileChip() {
  const loc = useLocation()
  const { loading: authLoading } = useAuth()
  const returnTo =
    loc.pathname && loc.pathname !== '/login' && !loc.pathname.startsWith('/auth/')
      ? `${loc.pathname}${loc.search}`
      : undefined

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[150] px-3 md:px-6">
      <div className="mx-auto flex w-full max-w-full justify-end md:max-w-3xl lg:max-w-4xl">
        <div className="pointer-events-auto flex flex-row flex-nowrap items-center gap-2 md:gap-3" dir="ltr">
          <LanguagePicker />
          {!authLoading && <ProfileChip returnTo={returnTo} className="shrink-0" />}
        </div>
      </div>
    </div>
  )
}
