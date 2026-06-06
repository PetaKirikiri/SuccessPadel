import { useEffect } from 'react'
import { CompetitionTable } from '../components/CompetitionTable'
import { useAuth } from '../hooks/useAuth'
import { useCompetitions } from '../hooks/useCompetitions'
import { linkGuestRostersByEmail } from '../lib/authProfile'

export function Competitions() {
  const { user, profile } = useAuth()
  const { rows, loading, error, refresh } = useCompetitions(user?.id)

  useEffect(() => {
    if (user) void linkGuestRostersByEmail().then(() => refresh())
  }, [user, refresh])

  return (
    <CompetitionTable
      rows={rows}
      loading={loading}
      error={error}
      isAdmin={Boolean(profile?.is_admin)}
      userId={user?.id}
      onRefresh={refresh}
    />
  )
}
