import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { SetupNotice } from './components/SetupNotice'
import { useAuth } from './hooks/useAuth'
import { useLockViewport } from './hooks/useLockViewport'
import { AuthProvider } from './providers/AuthProvider'
import { LocaleProvider } from './providers/LocaleProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { AdminGameForm } from './pages/AdminGameForm'
import { CourtGameForm } from './pages/CourtGameForm'
import { AdminGames } from './pages/AdminGames'
import { AdminSeasons } from './pages/AdminSeasons'
import { CompetitionForm } from './pages/CompetitionForm'
import { CompetitionJoin } from './pages/CompetitionJoin'
import { CompetitionPublicGate } from './pages/CompetitionPublicGate'
import { CompetitionRun } from './pages/CompetitionRun'
import { FriendlyGameForm } from './pages/FriendlyGameForm'
import { useFriendlyGame } from './hooks/useFriendlyGame'
import { canEditFriendlySession } from './lib/friendlyGames'
import { FriendlyGamePage } from './pages/FriendlyGamePage'
import { GamesHomePage } from './pages/GamesHomePage'
import { FriendlyCourtPage } from './pages/FriendlyCourtPage'
import { FriendlyPadPage } from './pages/FriendlyPadPage'
import { GesturePadPage } from './pages/GesturePadPage'
import { AuthCallback } from './pages/AuthCallback'
import { LineAuthCallback } from './pages/LineAuthCallback'
import { LineAuthComplete } from './pages/LineAuthComplete'
import { Login } from './pages/Login'
import { PlayerProfilePage } from './pages/PlayerProfilePage'
import { Profile } from './pages/Profile'
import { ResetPassword } from './pages/ResetPassword'
import { MembersPage } from './pages/MembersPage'
import { NativeDeepLinkHandler } from './components/NativeDeepLinkHandler'

const GestureScoreCourtRoute = lazy(() =>
  import('./pages/GestureScoreCourtPage').then((module) => ({
    default: module.GestureScoreCourtPage,
  })),
)
const ManualScoreCourtRoute = lazy(() =>
  import('./pages/ManualScoreCourtPage').then((module) => ({
    default: module.ManualScoreCourtPage,
  })),
)
const GestureScoreTestRoute = lazy(() =>
  import('./pages/GestureScoreTestPage').then((module) => ({
    default: module.GestureScoreTestPage,
  })),
)

function AdminRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { profile, loading, user } = useAuth()
  if (loading || (user && !profile)) {
    return <p className="game-subtle p-4 text-center">Loading…</p>
  }
  if (!profile?.is_admin) return <Navigate to="/competitive" replace />
  return children
}

function FriendlySessionEditRoute() {
  const { id } = useParams()
  const { profile, loading, user } = useAuth()
  const { game, loading: gameLoading } = useFriendlyGame(id)
  const isAdmin = Boolean(profile?.is_admin)

  if (loading || (user && !profile) || gameLoading) {
    return <p className="game-subtle p-4 text-center">Loading…</p>
  }
  if (!id || !game) return <Navigate to="/friendly" replace />
  if (!canEditFriendlySession(game, user?.id, isAdmin)) {
    return <Navigate to={`/friendly/${id}`} replace />
  }
  return <FriendlyGameForm />
}

function MainAppRoutes() {
  return (
    <Routes>
      <Route path="/login/login" element={<Navigate to="/login" replace />} />
      <Route path="/link" element={null} />
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
        path="/auth/line/callback"
        element={
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <LineAuthCallback />
          </div>
        }
      />
      <Route
        path="/auth/line/complete"
        element={
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <LineAuthComplete />
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
        path="/gesture-score-test"
        element={
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Suspense fallback={<p className="game-subtle p-4 text-center">Loading…</p>}>
              <GestureScoreTestRoute />
            </Suspense>
          </div>
        }
      />
      <Route path="/dev/gesture-score-test" element={<Navigate to="/gesture-score-test" replace />} />
      <Route
        element={
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Layout />
          </div>
        }
      >
        <Route index element={<Navigate to="/friendly" replace />} />
        <Route path="friendly" element={<GamesHomePage mode="friendly" />} />
        <Route path="friendly/new" element={<FriendlyGameForm />} />
        <Route
          path="friendly/:id/edit"
          element={
            <AdminRoute>
              <FriendlySessionEditRoute />
            </AdminRoute>
          }
        />
        <Route path="friendly/:id/pad" element={<FriendlyPadPage />} />
        <Route
          path="friendly/:id/games/:gameNumber/courts/:courtSlug/manual-score"
          element={
            <ProtectedRoute>
              <Suspense fallback={null}>
                <ManualScoreCourtRoute />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="friendly/:id/games/:gameNumber/courts/:courtSlug/gesture-score"
          element={
            <ProtectedRoute>
              <Suspense fallback={null}>
                <GestureScoreCourtRoute />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="friendly/:id/games/:gameNumber/courts/:courtSlug"
          element={<FriendlyCourtPage />}
        />
        <Route path="friendly/:id" element={<FriendlyGamePage />} />
        <Route
          path="competitions/:id/games/:gameNumber/courts/:courtId/gesture-score"
          element={
            <ProtectedRoute>
              <Suspense fallback={null}>
                <GestureScoreCourtRoute />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="competitions/:id/games/:gameNumber/courts/:courtId/live-court"
          element={<GesturePadPage />}
        />
        <Route path="competitive" element={<GamesHomePage mode="competitive" />} />
        <Route path="competitions" element={<Navigate to="/competitive" replace />} />
        <Route path="players/:playerId" element={<PlayerProfilePage />} />
        <Route
          path="members"
          element={
            <ProtectedRoute>
              <MembersPage />
            </ProtectedRoute>
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
        <Route path="competitions/:id" element={<CompetitionPublicGate />} />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <Profile />
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
  )
}

function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <SetupNotice />
      {children}
    </div>
  )
}

export default function App() {
  useLockViewport()

  return (
    <BrowserRouter>
      <ThemeProvider>
        <LocaleProvider>
        <AuthProvider>
          <AppShell>
            <NativeDeepLinkHandler />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <Routes>
              <Route
                path="/competitions/:id/join"
                element={
                  <AppFrame>
                    <CompetitionJoin />
                  </AppFrame>
                }
              />
              <Route
                path="/competitions/new"
                element={
                  <AppFrame>
                    <Layout />
                  </AppFrame>
                }
              >
                <Route
                  index
                  element={
                    <AdminRoute>
                      <AdminOnly>
                        <CompetitionForm />
                      </AdminOnly>
                    </AdminRoute>
                  }
                />
              </Route>
              <Route
                path="/competitions/:id/games/:gameNumber/courts/:courtId/gesture-pad"
                element={<Navigate to="/friendly" replace />}
              />
              <Route
                path="*"
                element={
                  <AppFrame>
                    <MainAppRoutes />
                  </AppFrame>
                }
              />
              </Routes>
            </div>
          </AppShell>
        </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
