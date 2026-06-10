import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { GestureAnnotationPad } from '../components/GestureAnnotationPad'
import { GesturePadDashboard } from '../components/GesturePadDashboard'
import { useAuth } from '../hooks/useAuth'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useMatchGestureLog } from '../hooks/useMatchGestureLog'
import { useTranslation } from '../hooks/useTranslation'
import { breakMinutesFromConfig } from '../lib/competitionLayout'
import { pivotScheduleByCourt, pivotScheduleByGame } from '../lib/competitionCourtBoard'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyStartsAtIso,
  isFreeFriendly,
} from '../lib/friendlyGames'
import { friendlyCourtSetupKey } from '../lib/friendlyCourtLive'
import { resetPadGameState } from '../lib/friendlyMatch'
import { quadrantPlayersForCourt } from '../lib/gesturePadPlayers'
import { isReviewableLog } from '../lib/matchReviewHydrate'
import { formatDateInput } from '../lib/courtSchedule'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'

export function FriendlyCourtPage() {
  const { id, gameNumber, courtSlug } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [padEpoch, setPadEpoch] = useState(0)
  const [undoSignal, setUndoSignal] = useState(0)
  const { user, profile, loading } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const gameNum = Number(gameNumber)
  const courtLabel = courtSlug ? decodeURIComponent(courtSlug) : ''
  const { game, loading: gameLoading } = useFriendlyGame(id)
  const courtSetupKey =
    id && courtLabel && Number.isFinite(gameNum)
      ? friendlyCourtSetupKey(id, gameNum, courtLabel)
      : undefined
  const { log, loading: logLoading } = useMatchGestureLog(courtSetupKey)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [courtNames, setCourtNames] = useState<string[]>([])

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .order('display_name')
      .then(({ data }) => setProfiles((data as Profile[]) ?? []))
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.rpc('list_setup_courts')
      if (active && Array.isArray(data)) {
        setCourtNames(
          (data as { name: string; sort_order: number }[])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => c.name),
        )
      }
    })()
    return () => {
      active = false
    }
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

  const courtMatch = useMemo(() => {
    if (!displayGame || !courtLabel || !Number.isFinite(gameNum)) return null
    const config = displayGame.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
    const organizedConfig = {
      ...DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
      ...config,
      day: config.day || formatDateInput(new Date()),
    }
    const previewGames = friendlyPreviewGames(displayGame, courtNames, displayGame.profileAvatars)
    const session = friendlyOrganizedSession(organizedConfig)
    const startsAtIso = friendlyStartsAtIso(organizedConfig)
    const breakMinutes = breakMinutesFromConfig(session.scoring_config)
    const columns = pivotScheduleByCourt(
      previewGames,
      startsAtIso,
      organizedConfig.gameMinutes,
      breakMinutes,
    )
    const games = pivotScheduleByGame(columns)
    const scheduleGame = games.find((g) => g.gameNumber === gameNum)
    return scheduleGame?.courts.find((c) => c.courtLabel === courtLabel) ?? null
  }, [courtLabel, courtNames, displayGame, gameNum])

  const quadrantPlayers = useMemo(() => {
    if (!courtMatch) return null
    return quadrantPlayersForCourt(
      courtMatch.teamA,
      courtMatch.teamB,
      courtMatch.teamAPlayers,
      courtMatch.teamBPlayers,
    )
  }, [courtMatch])

  const sessionRoster = useMemo(() => {
    if (!courtMatch?.teamAPlayers || !courtMatch?.teamBPlayers) return null
    return [...courtMatch.teamAPlayers, ...courtMatch.teamBPlayers]
  }, [courtMatch])

  const isAdmin = Boolean(profile?.is_admin)
  const hasReviewableLog = isReviewableLog(log)
  const reviewMode = !isAdmin || hasReviewableLog

  if (loading || gameLoading || logLoading || (user && !profile)) {
    return <p className="p-4 text-center text-sm text-brand-muted">{t('common.loading')}</p>
  }
  if (
    !user ||
    !profile ||
    !game ||
    !displayGame ||
    !quadrantPlayers ||
    !sessionRoster ||
    !courtSetupKey ||
    !courtLabel
  ) {
    return <Navigate to="/friendly" replace />
  }
  if (!isAdmin && !hasReviewableLog) {
    return <Navigate to={`/friendly/${game.id}`} replace />
  }

  const backTo = isFreeFriendly(game) ? '/friendly' : `/friendly/${game.id}`

  const handleResetGame = () => {
    if (!window.confirm(t('pad.resetConfirm'))) return
    resetPadGameState(courtSetupKey, { friendly: true })
    setPadEpoch((epoch) => epoch + 1)
  }

  return (
    <div className="gesture-pad-page fixed inset-0 z-[400] flex flex-col overflow-hidden bg-[#1a5fa8]">
      <div className="gesture-pad-device flex min-h-0 flex-1 flex-col">
        <GestureAnnotationPad
          key={padEpoch}
          courtSetupKey={courtSetupKey}
          gameNumber={String(gameNum)}
          onMatchClosed={() => navigate(backTo)}
          quadrantPlayers={quadrantPlayers}
          sessionRoster={sessionRoster}
          currentUserId={user.id}
          currentUserAvatarUrl={headerAvatar}
          friendly
          reviewMode={reviewMode}
          undoSignal={undoSignal}
        />
      </div>
      <GesturePadDashboard
        onBack={() => navigate(backTo)}
        backLabel={t('common.back')}
        onUndo={isAdmin && !reviewMode ? () => setUndoSignal((n) => n + 1) : undefined}
        onResetGame={isAdmin && !reviewMode ? handleResetGame : undefined}
        onStats={
          isAdmin ? () => navigate(`/friendly/${game.id}/heatmap`) : undefined
        }
      />
    </div>
  )
}
