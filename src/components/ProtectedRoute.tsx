import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { saveReturnTo } from '../lib/authReturnTo'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    )
  }
  if (!session) {
    saveReturnTo(loc.pathname)
    return (
      <Navigate to="/login?email=1" state={{ from: loc.pathname }} replace />
    )
  }
  return children
}
