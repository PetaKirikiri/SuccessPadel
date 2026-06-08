import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isCompetitionPublicViewPath } from '../lib/competitionRoutes'
import { GuestSignInChip } from './GuestSignInChip'
import { LanguagePicker } from './LanguagePicker'
import { ProfileChip } from './ProfileChip'

export function GlobalProfileChip() {
  const loc = useLocation()
  const { user, loading: authLoading } = useAuth()
  const onCompetitionPublic = isCompetitionPublicViewPath(loc.pathname)
  const signedIn = Boolean(user)
  const returnTo =
    loc.pathname && loc.pathname !== '/login' && !loc.pathname.startsWith('/auth/')
      ? `${loc.pathname}${loc.search}`
      : undefined
  const showProfileChip =
    !authLoading && (!onCompetitionPublic || signedIn)
  const showGuestChip = onCompetitionPublic && !authLoading && !signedIn

  return (
    <div className="pointer-events-none fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[150]">
      <div className="pointer-events-auto flex flex-row flex-nowrap items-center gap-2 md:gap-3" dir="ltr">
        <LanguagePicker />
        {showProfileChip && <ProfileChip returnTo={returnTo} className="shrink-0" />}
        {showGuestChip && <GuestSignInChip returnTo={returnTo} className="shrink-0" />}
      </div>
    </div>
  )
}
