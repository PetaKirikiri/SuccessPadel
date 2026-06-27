import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { CompetitionTable, splitCompetitionRows } from '../components/CompetitionTable'
import { FriendlyGamesList } from '../components/FriendlyGamesList'
import { GamesHubView } from '../components/GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useCompetitionSetup } from '../hooks/useCompetitionSetup'
import { usePublicFriendlyGames } from '../hooks/usePublicFriendlyGames'
import { linkGuestRostersByEmail } from '../lib/authProfile'
import type { Gender } from '../lib/competitionPresets'
import { splitFriendlyGames } from '../lib/friendlyGames'
import { normalizeSessionGender } from '../lib/inviteBanners'

type Mode = 'friendly' | 'competitive'

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

export function GamesHomePage({ mode }: { mode: Mode }) {
  const { user, profile, loading: authLoading } = useAuth()
  const location = useLocation()
  const friendly = usePublicFriendlyGames()
  const competition = useCompetitionSetup()
  const isAdmin = !authLoading && Boolean(profile?.is_admin)
  const lineError = (location.state as { lineError?: string } | null)?.lineError

  const { currentGames, pastGames } = useMemo(
    () => splitFriendlyGames(friendly.games),
    [friendly.games],
  )
  const { currentRows, pastRows } = useMemo(
    () => splitCompetitionRows(competition.rows),
    [competition.rows],
  )
  const initialGenderFilter = useMemo(() => nextCompetitionGender(currentRows), [currentRows])

  useEffect(() => {
    if (mode === 'friendly' && location.pathname === '/friendly') void friendly.refresh()
  }, [mode, location.pathname, friendly.refresh])

  useEffect(() => {
    if (mode === 'competitive' && user) void linkGuestRostersByEmail().then(() => competition.refresh())
  }, [mode, user, competition.refresh])

  if (mode === 'competitive') {
    const tableProps = {
      rows: competition.rows,
      loading: authLoading || competition.loading,
      error: competition.error,
      isAdmin,
      userId: user?.id,
      onRefresh: competition.refresh,
      showListTabs: false as const,
    }

    return (
      <GamesHubView
        showPastTab
        hubNav="none"
        currentCount={currentRows.length}
        pastCount={pastRows.length}
        initialGenderFilter={initialGenderFilter}
        currentPanel={<CompetitionTable {...tableProps} listTab="current" />}
        pastPanel={<CompetitionTable {...tableProps} listTab="past" />}
      />
    )
  }

  const friendlyListProps = {
    loading: friendly.loading,
    isAdmin,
    onRefresh: friendly.refresh,
  }

  const errorBanner = (
    <>
      {lineError ? <p className="mb-2 text-xs text-red-600">{lineError}</p> : null}
      {friendly.error ? <p className="mb-2 text-xs text-red-600">{friendly.error}</p> : null}
    </>
  )

  return (
    <GamesHubView
      showPastTab
      hubNav="none"
      leaderboardVariant="friendly"
      currentCount={currentGames.length}
      pastCount={pastGames.length}
      currentPanel={
        <>
          {errorBanner}
          <FriendlyGamesList games={currentGames} {...friendlyListProps} />
        </>
      }
      pastPanel={
        <>
          {errorBanner}
          <FriendlyGamesList games={pastGames} past {...friendlyListProps} />
        </>
      }
    />
  )
}
