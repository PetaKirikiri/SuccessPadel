import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { GestureAnnotationPad } from '../components/GestureAnnotationPad'
import { GesturePadDashboard } from '../components/GesturePadDashboard'
import { useTranslation } from '../hooks/useTranslation'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { useMatchGestureLog } from '../hooks/useMatchGestureLog'
import {
  friendlyQuadrantPlayers,
  friendlyPadResetAt,
  friendlySessionRoster,
  isEndlessFriendly,
  isFreeFriendly,
} from '../lib/friendlyGames'
import { resetPadGameState } from '../lib/friendlyMatch'
import { isReviewableLog } from '../lib/matchReviewHydrate'

export function FriendlyPadPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [padEpoch, setPadEpoch] = useState(0)
  const [undoSignal, setUndoSignal] = useState(0)
  const { user, profile, loading } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const { game, loading: gameLoading } = useFriendlyGame(id)
  const { log, loading: logLoading } = useMatchGestureLog(id)

  const players = useMemo(() => (game ? friendlyQuadrantPlayers(game) : null), [game])
  const sessionRoster = useMemo(() => (game ? friendlySessionRoster(game) : null), [game])
  const reviewMode = isReviewableLog(log)

  if (loading || gameLoading || logLoading || (user && !profile)) {
    return <p className="p-4 text-center text-sm text-brand-muted">{t('common.loading')}</p>
  }
  if (!user || !profile?.is_admin || !game || !players || !sessionRoster) {
    return <Navigate to="/friendly" replace />
  }

  const handleResetGame = () => {
    if (
      !window.confirm(t('pad.resetConfirm'))
    ) {
      return
    }
    resetPadGameState(game.id, { friendly: true })
    setPadEpoch((epoch) => epoch + 1)
  }

  return (
    <div className="gesture-pad-page fixed inset-0 z-[400] flex flex-col overflow-hidden bg-[#1a5fa8]">
      <div className="gesture-pad-device flex min-h-0 flex-1 flex-col">
        <GestureAnnotationPad
          key={padEpoch}
          courtSetupKey={game.id}
          onMatchClosed={() =>
            navigate(isFreeFriendly(game) ? '/friendly' : `/friendly/${game.id}`)
          }
          quadrantPlayers={players}
          sessionRoster={sessionRoster}
          currentUserId={user?.id ?? null}
          currentUserAvatarUrl={headerAvatar}
          friendly
          endlessMatch={isEndlessFriendly(game)}
          padResetAt={friendlyPadResetAt(game)}
          reviewMode={reviewMode}
          undoSignal={undoSignal}
        />
      </div>
      <GesturePadDashboard
        onBack={() => navigate(isFreeFriendly(game) ? '/friendly' : `/friendly/${game.id}`)}
        backLabel={t('common.back')}
        onUndo={() => setUndoSignal((n) => n + 1)}
        onResetGame={handleResetGame}
        onStats={() => navigate(`/friendly/${game.id}/heatmap`)}
      />
    </div>
  )
}
