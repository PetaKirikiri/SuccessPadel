import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { CompetitionTable, splitCompetitionRows } from '../components/CompetitionTable'
import { GamesHubView } from '../components/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useCompetitionSetup } from '../hooks/useCompetitionSetup'
import { useTranslation } from '../hooks/useTranslation'
import { linkGuestRostersByEmail } from '../lib/authProfile'
import type { Gender } from '../lib/competitionPresets'
import { normalizeSessionGender } from '../lib/inviteBanners'

function competitionStartMs(row: { starts_at?: string | null; starts_on?: string | null }): number {
  const precise = row.starts_at ? Date.parse(row.starts_at) : NaN
  if (Number.isFinite(precise)) return precise
  const day = row.starts_on ? Date.parse(`${row.starts_on}T00:00:00+07:00`) : NaN
  return Number.isFinite(day) ? day : Number.MAX_SAFE_INTEGER
}

function nextCompetitionGender(rows: { starts_at?: string | null; starts_on?: string | null; gender?: string | null }[]): Gender | null {
  const withGender = rows
    .map((row) => ({ row, gender: normalizeSessionGender(row.gender), startsAt: competitionStartMs(row) }))
    .filter((item): item is { row: typeof item.row; gender: Gender; startsAt: number } => Boolean(item.gender))
    .sort((a, b) => a.startsAt - b.startsAt)
  return withGender[0]?.gender ?? null
}

export function CompetitiveHomePage() {
  const { t } = useTranslation()
  const { user, profile, loading: authLoading } = useAuth()
  const { rows, loading, error, refresh } = useCompetitionSetup()
  const isAdmin = Boolean(profile?.is_admin)
  const { currentRows, pastRows } = useMemo(() => splitCompetitionRows(rows), [rows])
  const initialGenderFilter = useMemo(() => nextCompetitionGender(currentRows), [currentRows])

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
      initialGenderFilter={initialGenderFilter}
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
