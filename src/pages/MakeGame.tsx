import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function MakeGame() {
  const { profile, loading } = useAuth()

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>
  if (profile?.is_admin) return <Navigate to="/admin/games/new" replace /> // court game form

  return (
    <div className="space-y-2 text-center text-sm text-zinc-600">
      <h2 className="text-xl font-semibold text-zinc-900">Make a game</h2>
      <p>Only organisers can create games. Use Find a game to join an open session.</p>
    </div>
  )
}
