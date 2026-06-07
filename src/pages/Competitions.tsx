import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CompetitionTable } from '../components/CompetitionTable'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { useCompetitionSetup } from '../hooks/useCompetitionSetup'
import { linkGuestRostersByEmail } from '../lib/authProfile'

export function Competitions() {
  const { t } = useTranslation()
  const { user, profile, loading: authLoading } = useAuth()
  const { rows, loading, error, refresh } = useCompetitionSetup()
  const isAdmin = Boolean(profile?.is_admin)

  useEffect(() => {
    if (user) void linkGuestRostersByEmail().then(() => refresh())
  }, [user, refresh])

  return (
    <div className="relative w-full min-w-0">
      {isAdmin && (
        <Link
          to="/competitions/new"
          aria-label={t('competition.addCompetitionFab')}
          className="fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-2xl font-semibold leading-none text-white shadow-lg bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
        >
          +
        </Link>
      )}
      <CompetitionTable
        rows={rows}
        loading={authLoading || loading}
        error={error}
        isAdmin={isAdmin}
        userId={user?.id}
        onRefresh={refresh}
      />
    </div>
  )
}
