import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CompetitionTable, splitCompetitionRows } from '../components/CompetitionTable'
import { GamesHubView } from '../components/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useCompetitionSetup } from '../hooks/useCompetitionSetup'
import { useTranslation } from '../hooks/useTranslation'
import { linkGuestRostersByEmail } from '../lib/authProfile'

export function CompetitiveHomePage() {
  const { t } = useTranslation()
  const { user, profile, loading: authLoading } = useAuth()
  const { rows, loading, error, refresh } = useCompetitionSetup()
  const isAdmin = Boolean(profile?.is_admin)
  const { currentRows, pastRows } = useMemo(() => splitCompetitionRows(rows), [rows])

  useEffect(() => {
    if (user) void linkGuestRostersByEmail().then(() => refresh())
  }, [user, refresh])

  const tableProps = {
    rows,
    loading: authLoading || loading,
    error,
    isAdmin,
    userId: user?.id,
    onRefresh: refresh,
    showListTabs: false as const,
  }

  return (
    <GamesHubView
      showPastTab
      currentCount={currentRows.length}
      pastCount={pastRows.length}
      fab={
        isAdmin ? (
          <Link
            to="/competitions/new"
            aria-label={t('competition.addCompetitionFab')}
            className="fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-2xl font-semibold leading-none text-white shadow-lg bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
          >
            +
          </Link>
        ) : null
      }
      currentPanel={<CompetitionTable {...tableProps} listTab="current" />}
      pastPanel={<CompetitionTable {...tableProps} listTab="past" />}
    />
  )
}
