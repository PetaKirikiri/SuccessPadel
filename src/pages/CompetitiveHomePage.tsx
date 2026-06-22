import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
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
      currentTabAddon={
        isAdmin ? (
          <Link
            to="/competitions/new"
            aria-label={t('competition.addCompetitionFab')}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-accent text-white shadow-sm active:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </Link>
        ) : null
      }
      currentPanel={<CompetitionTable {...tableProps} listTab="current" />}
      pastPanel={<CompetitionTable {...tableProps} listTab="past" />}
    />
  )
}
