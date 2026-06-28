import { useMemo, useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { GestureAnnotationPad } from '../components/GestureAnnotationPad'
import { GesturePadDashboard } from '../components/GesturePadDashboard'
import { GesturePadShell } from '../surfaces/gesture-score'
import { useTranslation } from '../hooks/useTranslation'
import { useAuth } from '../hooks/useAuth'
import { useCompetitionBoard } from '../hooks/useCompetitionBoard'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { usePublicCompetition } from '../hooks/usePublicCompetition'
import { pivotScheduleByGame } from '../lib/competitionCourtBoard'
import { quadrantPlayersForGesturePad } from '../lib/gesturePadPlayers'
import { useMatchGestureLog } from '../hooks/useMatchGestureLog'
import { resetPadGameState } from '../lib/friendlyMatch'
import { supabase } from '../lib/supabaseClient'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'

export function GesturePadPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id, gameNumber, courtId } = useParams()
  const { user, profile, loading } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const gameNum = Number(gameNumber)
  const [padEpoch, setPadEpoch] = useState(0)
  const [undoSignal, setUndoSignal] = useState(0)
  const courtSetupKey =
    id && gameNumber && courtId ? `${id}-${gameNumber}-${courtId}` : undefined
  const { loading: logLoading } = useMatchGestureLog(courtSetupKey)
  const { session, rounds, roster, clubCourts, courtMatches, applyMatchScore } =
    usePublicCompetition(id)
  const { columns, liveCourtsByGame } = useCompetitionBoard(
    session,
    rounds,
    roster,
    clubCourts,
    courtMatches,
  )

  const games = useMemo(() => pivotScheduleByGame(columns), [columns])
  const quadrantPlayers = useMemo(
    () =>
      quadrantPlayersForGesturePad(
        liveCourtsByGame.get(gameNum) ?? [],
        games.find((g) => g.gameNumber === gameNum),
        courtId,
      ),
    [courtId, gameNum, games, liveCourtsByGame],
  )

  const roundId = useMemo(
    () => rounds.find((r) => r.round_number === gameNum)?.id,
    [gameNum, rounds],
  )

  const sessionRoster = useMemo(() => {
    const live = (liveCourtsByGame.get(gameNum) ?? []).find((c) => c.courtId === courtId)
    if (live?.teamAPlayers?.length && live?.teamBPlayers?.length) {
      return [...live.teamAPlayers, ...live.teamBPlayers]
    }
    const court = games.find((g) => g.gameNumber === gameNum)?.courts.find((c) => c.courtLabel === courtId)
    if (court?.teamAPlayers?.length && court?.teamBPlayers?.length) {
      return [...court.teamAPlayers, ...court.teamBPlayers]
    }
    return null
  }, [courtId, gameNum, games, liveCourtsByGame])

  const submitMatch = useCallback(
    async (entry: CourtScoreSubmit) => {
      const winTeam = entry.teamA >= entry.teamB ? 'a' : 'b'
      const { error: err } = await supabase.rpc('record_competition_match', {
        p_round_id: entry.roundId,
        p_court_id: entry.courtId,
        p_score_summary: `${entry.teamA}-${entry.teamB}`,
        p_winner_team: winTeam,
        p_margin_bonus: false,
        p_team_a_points: entry.teamA,
        p_team_b_points: entry.teamB,
      })
      if (err) throw new Error(err.message)
      applyMatchScore(entry.roundId, entry.courtId, `${entry.teamA}-${entry.teamB}`)
    },
    [applyMatchScore],
  )

  const goBack = () => {
    if (id) navigate(`/competitions/${id}`)
    else navigate(-1)
  }

  const handleResetGame = () => {
    if (!courtSetupKey) return
    if (
      !window.confirm(t('pad.resetConfirm'))
    ) {
      return
    }
    resetPadGameState(courtSetupKey)
    setPadEpoch((epoch) => epoch + 1)
  }

  if (loading || logLoading || (user && !profile)) {
    return <p className="p-4 text-center text-sm text-brand-muted">{t('common.loading')}</p>
  }
  if (!user || !profile?.is_admin) {
    return <Navigate to={id ? `/competitions/${id}` : '/competitions'} replace />
  }

  return (
    <GesturePadShell
      dashboard={
        <GesturePadDashboard
          onBack={goBack}
          backLabel={t('common.back')}
          onUndo={courtSetupKey ? () => setUndoSignal((n) => n + 1) : undefined}
          onResetGame={courtSetupKey ? handleResetGame : undefined}
          competitionId={id}
          gameNumber={gameNumber}
        />
      }
    >
      <GestureAnnotationPad
          key={padEpoch}
          competitionId={id}
          gameNumber={gameNumber}
          courtSetupKey={courtSetupKey}
          courtId={courtId}
          roundId={roundId}
          onSubmitMatch={roundId && courtId ? submitMatch : undefined}
          onMatchClosed={goBack}
          quadrantPlayers={quadrantPlayers}
          sessionRoster={sessionRoster ?? undefined}
          currentUserId={user?.id ?? null}
          currentUserAvatarUrl={headerAvatar}
          undoSignal={undoSignal}
      />
    </GesturePadShell>
  )
}
