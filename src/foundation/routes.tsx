import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './Layout'
import { ProtectedRoute } from './ProtectedRoute'
import { SetupNotice } from './SetupNotice'
import { useAuth } from '../hooks/useAuth'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { canEditFriendlySession } from '../lib/friendlyGames'
import { CompetitionForm } from '../components/SetupCard/SetupCardEventForm'
import { FriendlyGameForm } from '../components/SetupCard/SetupCardSessionForm'
import { FriendlyGamePage } from '../foundation/play/GameCardPlaySession'
import { GamesHomePage } from '../components/InviteCard/GamesHomeSurface'
import { PublicSessionGate } from './PublicSessionGate'
import { PlayerProfilePage } from './profile/PlayerProfileSurface'
import { AuthCallback } from './AuthCallback'
import { LineAuthCallback } from './LineAuthCallback'
import { LineAuthComplete } from './LineAuthComplete'
import { Login } from './Login'
import { Profile } from './Profile'
import { ResetPassword } from './ResetPassword'
import { MembersPage } from './MembersPage'
import { CameraScoreTrackerShell } from '../components/CameraScoreTracker'

function GestureScoreCourtLoading() {
  return <CameraScoreTrackerShell>{null}</CameraScoreTrackerShell>
}

const GestureScoreCourtRoute = lazy(() =>
  import('../components/CameraScoreTracker/CameraScoreTracker.logic').then((module) => ({
    default: module.GestureScoreCourtPage,
  })),
)

function GestureScoreCourtEntry() {
  return (
    <Suspense fallback={<GestureScoreCourtLoading />}>
      <GestureScoreCourtRoute />
    </Suspense>
  )
}

const ManualScoreCourtRoute = lazy(() =>
  import('../foundation/play/ManualScoreCourtSurface').then((module) => ({
    default: module.ManualScoreCourtPage,
  })),
)

const GestureScorePadRoute = lazy(() =>
  import('../components/CameraScoreTracker/CameraScoreTrackerPractice').then((module) => ({
    default: module.GestureScorePadPage,
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
        path="/gesture-score-pad"
        element={
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Suspense fallback={<p className="game-subtle p-4 text-center">Loading…</p>}>
              <GestureScorePadRoute />
            </Suspense>
          </div>
        }
      />
      <Route path="/gesture-score-test" element={<Navigate to="/gesture-score-pad" replace />} />
      <Route path="/dev/gesture-score-test" element={<Navigate to="/gesture-score-pad" replace />} />
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
          element={<GestureScoreCourtEntry />}
        />
        <Route path="friendly/:id" element={<FriendlyGamePage />} />
        <Route
          path="competitions/:id/games/:gameNumber/courts/:courtId/gesture-score"
          element={
            <ProtectedRoute>
              <GestureScoreCourtEntry />
            </ProtectedRoute>
          }
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
        <Route path="competitions/:id" element={<PublicSessionGate />} />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
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

export function AppRoutes() {
  return (
    <Routes>
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
        path="*"
        element={
          <AppFrame>
            <MainAppRoutes />
          </AppFrame>
        }
      />
    </Routes>
  )
}
