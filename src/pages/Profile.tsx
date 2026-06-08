import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Profile() {
  const { profile, loading, refreshProfile } = useAuth()

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  if (loading || !profile) {
    return <p className="py-6 text-center text-xs text-brand-muted">…</p>
  }

  return <Navigate to={`/players/${profile.id}`} replace />
}
