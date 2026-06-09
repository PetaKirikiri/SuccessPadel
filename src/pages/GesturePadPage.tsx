import { useMemo, useCallback } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { GestureAnnotationPad } from '../components/GestureAnnotationPad'
import { GesturePadToolbar } from '../components/GesturePadToolbar'
import { useAuth } from '../hooks/useAuth'
import { useCompetitionBoard } from '../hooks/useCompetitionBoard'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { usePublicCompetition } from '../hooks/usePublicCompetition'
import { pivotScheduleByGame } from '../lib/competitionCourtBoard'
import { quadrantPlayersForGesturePad } from '../lib/gesturePadPlayers'
import { supabase } from '../lib/supabaseClient'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'

export function GesturePadPage() {
  const navigate = useNavigate()
  const { id, gameNumber, courtId } = useParams()
  const { user, profile, loading } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const gameNum = Number(gameNumber)
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

  if (loading || (user && !profile)) {
    return <p className="p-4 text-center text-sm text-brand-muted">Loading…</p>
  }
  if (!user || !profile?.is_admin) {
    return <Navigate to={id ? `/competitions/${id}` : '/competitions'} replace />
  }

  return (
    <div className="gesture-pad-page fixed inset-0 z-[400] flex flex-col overflow-hidden bg-[#1a5fa8]">
      <GesturePadToolbar
        onBack={goBack}
        backLabel="← Back"
        competitionId={id}
        gameNumber={gameNumber}
      />
      <GestureAnnotationPad
        competitionId={id}
        gameNumber={gameNumber}
        courtSetupKey={
          id && gameNumber && courtId ? `${id}-${gameNumber}-${courtId}` : undefined
        }
        courtId={courtId}
        roundId={roundId}
        onSubmitMatch={roundId && courtId ? submitMatch : undefined}
        onMatchClosed={goBack}
        quadrantPlayers={quadrantPlayers}
        currentUserId={user?.id ?? null}
        currentUserAvatarUrl={headerAvatar}
      />
    </div>
  )
}
