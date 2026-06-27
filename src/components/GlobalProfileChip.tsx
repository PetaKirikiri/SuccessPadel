import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AppShellColumn } from './AppShellColumn'
import { ProfileChip } from './ProfileChip'

export function GlobalProfileChip() {
  const loc = useLocation()
  const { loading: authLoading } = useAuth()
  const returnTo =
    loc.pathname && loc.pathname !== '/login' && !loc.pathname.startsWith('/auth/')
      ? `${loc.pathname}${loc.search}`
      : undefined

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[150]">
      <AppShellColumn fill={false} className="flex justify-end">
        <div className="pointer-events-auto flex flex-row flex-nowrap items-center gap-2 md:gap-3" dir="ltr">
          {!authLoading && <ProfileChip returnTo={returnTo} className="shrink-0" />}
        </div>
      </AppShellColumn>
    </div>
  )
}
