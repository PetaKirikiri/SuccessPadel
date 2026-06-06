import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './hooks/useAuth'
import { useLockViewport } from './hooks/useLockViewport'
import { initLiff } from './lib/line/liff'
import { AdminGameForm } from './pages/AdminGameForm'
import { CourtGameForm } from './pages/CourtGameForm'
import { AdminGames } from './pages/AdminGames'
import { AdminSeasons } from './pages/AdminSeasons'
import { AuthCallback } from './pages/AuthCallback'
import { CompetitionForm } from './pages/CompetitionForm'
import { CompetitionRun } from './pages/CompetitionRun'
import { Competitions } from './pages/Competitions'
import { FindGame } from './pages/FindGame'
import { Leaderboard } from './pages/Leaderboard'
import { Login } from './pages/Login'
import { Profile } from './pages/Profile'
import { ResetPassword } from './pages/ResetPassword'
import { MakeGame } from './pages/MakeGame'
import { MatchNew } from './pages/MatchNew'
import { Week } from './pages/Week'

function AdminRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { profile, loading, user } = useAuth()
  if (loading || (user && !profile)) {
    return <p className="game-subtle p-4 text-center">Loading…</p>
  }
  if (!profile?.is_admin) return <Navigate to="/fun" replace />
  return children
}

export default function App() {
  useLockViewport()

  useEffect(() => {
    void initLiff().catch(() => {})
  }, [])

  return (
    <BrowserRouter>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Routes>
        <Route
          path="/login"
          element={
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <Login />
            </div>
          }
        />
        <Route
          path="/auth/callback"
          element={
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <AuthCallback />
            </div>
          }
        />
        <Route
          path="/auth/reset-password"
          element={
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <ResetPassword />
            </div>
          }
        />
        <Route
          element={
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <Layout />
            </div>
          }
        >
          <Route index element={<Leaderboard />} />
          <Route
            path="fun/new"
            element={
              <AdminRoute>
                <AdminOnly>
                  <CourtGameForm />
                </AdminOnly>
              </AdminRoute>
            }
          />
          <Route path="fun" element={<FindGame />} />
          <Route path="find" element={<Navigate to="/fun" replace />} />
          <Route path="make" element={<MakeGame />} />
          <Route path="competitions" element={<Competitions />} />
          <Route
            path="competitions/new"
            element={
              <AdminRoute>
                <AdminOnly>
                  <CompetitionForm />
                </AdminOnly>
              </AdminRoute>
            }
          />
          <Route
            path="competitions/:id/edit"
            element={
              <AdminRoute>
                <AdminOnly>
                  <CompetitionForm />
                </AdminOnly>
              </AdminRoute>
            }
          />
          <Route path="competitions/:id/run" element={<CompetitionRun />} />
          <Route path="week" element={<Week />} />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="match/new"
            element={
              <ProtectedRoute>
                <MatchNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/games"
            element={
              <AdminRoute>
                <AdminOnly>
                  <AdminGames />
                </AdminOnly>
              </AdminRoute>
            }
          />
          <Route
            path="admin/games/new"
            element={
              <AdminRoute>
                <AdminOnly>
                  <CourtGameForm />
                </AdminOnly>
              </AdminRoute>
            }
          />
          <Route
            path="admin/games/competition/new"
            element={
              <AdminRoute>
                <AdminOnly>
                  <AdminGameForm />
                </AdminOnly>
              </AdminRoute>
            }
          />
          <Route
            path="admin/games/:id/edit"
            element={
              <AdminRoute>
                <AdminOnly>
                  <AdminGameForm />
                </AdminOnly>
              </AdminRoute>
            }
          />
          <Route
            path="admin/seasons"
            element={
              <AdminRoute>
                <AdminOnly>
                  <AdminSeasons />
                </AdminOnly>
              </AdminRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
    </BrowserRouter>
  )
}
