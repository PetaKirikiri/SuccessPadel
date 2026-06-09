import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { GestureAnnotationPad } from '../components/GestureAnnotationPad'
import { GesturePadToolbar } from '../components/GesturePadToolbar'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { friendlyQuadrantPlayers, isFreeFriendly } from '../lib/friendlyGames'

export function FriendlyPadPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const { game, loading: gameLoading } = useFriendlyGame(id)

  if (loading || gameLoading || (user && !profile)) {
    return <p className="p-4 text-center text-sm text-brand-muted">Loading…</p>
  }
  if (!user || !profile?.is_admin || !game) {
    return <Navigate to="/friendly" replace />
  }

  return (
    <div className="gesture-pad-page fixed inset-0 z-[400] flex flex-col overflow-hidden bg-[#1a5fa8]">
      <GesturePadToolbar
        onBack={() => navigate(isFreeFriendly(game) ? '/friendly' : `/friendly/${game.id}`)}
        backLabel="← Back"
      />
      <GestureAnnotationPad
        courtSetupKey={game.id}
        onMatchClosed={() =>
          navigate(isFreeFriendly(game) ? '/friendly' : `/friendly/${game.id}`)
        }
        quadrantPlayers={friendlyQuadrantPlayers(game)}
        currentUserId={user?.id ?? null}
        currentUserAvatarUrl={headerAvatar}
        friendly
      />
    </div>
  )
}
