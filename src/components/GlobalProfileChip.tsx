import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompetitionPlayerLinked } from '../hooks/useCompetitionPlayerLinked'
import {
  competitionIdFromPublicPath,
  isCompetitionPublicViewPath,
} from '../lib/competitionRoutes'
import { GuestSignInChip } from './GuestSignInChip'
import { LanguagePicker } from './LanguagePicker'
import { ProfileChip } from './ProfileChip'

export function GlobalProfileChip() {
  const loc = useLocation()
  const { user, loading: authLoading } = useAuth()
  const onCompetitionPublic = isCompetitionPublicViewPath(loc.pathname)
  const competitionId = onCompetitionPublic
    ? competitionIdFromPublicPath(loc.pathname)
    : null
  const { linked, checking } = useCompetitionPlayerLinked(competitionId, user?.id)
  const returnTo =
    loc.pathname && loc.pathname !== '/login' && !loc.pathname.startsWith('/auth/')
      ? `${loc.pathname}${loc.search}`
      : undefined
  const showLinkedProfile =
    onCompetitionPublic && !authLoading && !checking && Boolean(user && linked)
  const showGuestChip =
    onCompetitionPublic && !authLoading && !checking && !(user && linked)
  const showDefaultChip = !onCompetitionPublic

  return (
    <div className="pointer-events-none fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[150]">
      <div className="pointer-events-auto flex flex-row flex-nowrap items-center gap-2 md:gap-3" dir="ltr">
        <LanguagePicker />
        {showLinkedProfile && <ProfileChip returnTo={returnTo} className="shrink-0" />}
        {showGuestChip && <GuestSignInChip returnTo={returnTo} className="shrink-0" />}
        {showDefaultChip && <ProfileChip returnTo={returnTo} className="shrink-0" />}
      </div>
    </div>
  )
}
