import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CompetitionLayoutPreview } from '../components/CompetitionLayoutPreview'
import { FriendlyLateStartPanel } from '../components/FriendlyLateStartPanel'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { useFriendlyLiveCourtScores } from '../hooks/useFriendlyLiveCourtScores'
import { useMatchGestureLog } from '../hooks/useMatchGestureLog'
import { useTranslation } from '../hooks/useTranslation'
import { isReviewableLog } from '../lib/matchReviewHydrate'
import {
  canJoinFriendlyGame,
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyStartsAtIso,
  isFreeFriendly,
  isOnFriendlyRoster,
} from '../lib/friendlyGames'
import { joinFriendlySession } from '../lib/friendlyServer'
import {
  saveFriendlyManualCourtScore,
  type FriendlyCourtScoreSubmit,
} from '../lib/friendlyManualScore'
import { americanoScoringUnit } from '../lib/competitionPresets'
import { useSetupCourts } from '../hooks/useSetupCourts'
import { formatDateInput } from '../lib/courtSchedule'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'

export function FriendlyGamePage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const isAdmin = Boolean(profile?.is_admin)
  const { game, loading, refresh } = useFriendlyGame(id)
  const { log } = useMatchGestureLog(id)
  const finished = isReviewableLog(log)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const { courtNames, courtRefs } = useSetupCourts()
  const liveCourtScores = useFriendlyLiveCourtScores(id)
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .order('display_name')
      .then(({ data }) => setProfiles((data as Profile[]) ?? []))
  }, [])

  const displayGame = useMemo(() => {
    if (!game) return null
    if (game.profileAvatars?.length) return game
    if (!game.profileIds) return game
    return {
      ...game,
      profileAvatars: game.profileIds.map((pid) =>
        pid ? (profiles.find((p) => p.id === pid)?.avatar_url ?? null) : null,
      ),
    }
  }, [game, profiles])

  const organizedConfig = useMemo(() => {
    const base = game?.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
    return {
      ...DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
      ...base,
      day: base.day || formatDateInput(new Date()),
    }
  }, [game?.organizedConfig])

  const previewGames = useMemo(
    () => (displayGame ? friendlyPreviewGames(displayGame, courtNames, displayGame.profileAvatars) : []),
    [displayGame, courtNames],
  )

  const previewSession = useMemo(
    () => friendlyOrganizedSession(organizedConfig),
    [organizedConfig],
  )

  const scoreUnit = useMemo(() => americanoScoringUnit(previewSession), [previewSession])

  const handleSubmitFriendlyScores = useCallback(
    async (entries: FriendlyCourtScoreSubmit[]) => {
      if (!game) return
      for (const entry of entries) {
        const { error } = await saveFriendlyManualCourtScore(game.id, entry, scoreUnit)
        if (error) throw new Error(error)
      }
    },
    [game, scoreUnit],
  )

  const join = async () => {
    if (!game || !user) return
    setJoinBusy(true)
    setJoinError(null)
    const err = await joinFriendlySession(game.id)
    setJoinBusy(false)
    if (err) {
      setJoinError(err)
      return
    }
    await refresh()
  }

  if (loading) return <p className="text-sm text-brand-muted">{t('common.loading')}</p>
  if (!id || !game || !displayGame) return <Navigate to="/friendly" replace />

  const gameMinutes = organizedConfig.gameMinutes
  const startsAtIso = friendlyStartsAtIso(organizedConfig)
  const showJoin = canJoinFriendlyGame(game, user?.id)
  const joined = isOnFriendlyRoster(game, user?.id)
  const isFree = isFreeFriendly(game)

  return (
    <div className="space-y-3 pb-6">
      <Link to="/friendly" className="text-sm font-medium text-brand-accent">
        {t('common.back')}
      </Link>

      {isAdmin ? (
        <Link
          to={`/friendly/${game.id}/edit`}
          className="brand-btn-outline block w-full py-2.5 text-center text-sm font-semibold"
        >
          {t('friendly.edit')}
        </Link>
      ) : null}

      {!isFree && previewGames.length > 0 ? (
        <CompetitionLayoutPreview
          session={previewSession}
          games={previewGames}
          eventStartsAt={startsAtIso}
          gameMinutes={gameMinutes}
          friendlySessionId={game.id}
          friendly
          isAdmin={isAdmin}
          currentUserId={user?.id}
          currentUserAvatarUrl={headerAvatar}
          courtRefs={courtRefs}
          liveCourtScores={liveCourtScores}
          onSubmitFriendlyScores={isAdmin ? handleSubmitFriendlyScores : undefined}
          onFriendlyScoresSaved={refresh}
        />
      ) : null}

      {isAdmin && !isFree && game.status === 'ready' ? (
        <FriendlyLateStartPanel
          game={game}
          config={organizedConfig}
          onUpdated={refresh}
        />
      ) : null}

      <div className="game-card space-y-2 p-3">
        {showJoin ? (
          <button
            type="button"
            disabled={joinBusy}
            onClick={() => void join()}
            className="brand-btn w-full py-3 text-sm font-semibold disabled:opacity-50"
          >
            {joinBusy ? t('common.loading') : t('friendly.join')}
          </button>
        ) : null}

        {joined && !isAdmin ? (
          <p className="text-center text-xs text-brand-muted">{t('friendly.onRoster')}</p>
        ) : null}

        {isAdmin && isFree ? (
          <Link
            to={`/friendly/${game.id}/pad`}
            className="brand-btn block w-full py-3 text-center text-sm font-semibold"
          >
            {t('friendly.openPad')}
          </Link>
        ) : null}

        {isAdmin && finished ? (
          <Link
            to={`/friendly/${game.id}/heatmap`}
            className="block w-full rounded-xl border border-brand-border bg-brand-surface py-3 text-center text-sm font-semibold text-brand-primary transition active:opacity-80"
          >
            {t('stats.title')}
          </Link>
        ) : null}

        {joinError ? <p className="text-xs text-red-600">{joinError}</p> : null}
      </div>
    </div>
  )
}
