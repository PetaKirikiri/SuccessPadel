import { useLocation } from 'react-router-dom'
import { LanguagePicker } from './LanguagePicker'
import { ProfileChip } from './ProfileChip'

export function GlobalProfileChip() {
  const loc = useLocation()
  const returnTo =
    loc.pathname && loc.pathname !== '/login' && !loc.pathname.startsWith('/auth/')
      ? `${loc.pathname}${loc.search}`
      : undefined

  return (
    <div className="pointer-events-none fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[150]">
      <div className="pointer-events-auto flex flex-row flex-nowrap items-center gap-2 md:gap-3" dir="ltr">
        <LanguagePicker />
        <ProfileChip returnTo={returnTo} className="shrink-0" />
      </div>
    </div>
  )
}
