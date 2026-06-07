import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CompetitionCourtBoard } from './CompetitionCourtBoard'
import { useCompetitionBoard } from '../hooks/useCompetitionBoard'
import { usePublicCompetition } from '../hooks/usePublicCompetition'
import { americanoScheduleFromSession, gameSlotTimes } from '../lib/competitionLayout'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import { supabase } from '../lib/supabaseClient'

type Props = {
  sessionId: string
  title: string
  isAdmin?: boolean
  onListRefresh?: () => void
}

export function CompetitionCurrentGameCard({
  sessionId,
  title,
  isAdmin = false,
  onListRefresh,
}: Props) {
  const startingRef = useRef(false)
  const {
    session,
    rounds,
    activeRound,
    courtMatches,
    roster,
    clubCourts,
    loading,
    error,
    refresh,
    applyMatchScore,
  } = usePublicCompetition(sessionId)

  const {
    columns,
    liveCourtsByGame,
    roundIdForGame,
    courtIdByLabel,
    scoreUnit,
    playTo,
    matchForCourt,
  } = useCompetitionBoard(session, rounds, roster, clubCourts, courtMatches)

  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const needsStart =
    isAdmin &&
    session?.status === 'open' &&
    !session.competition_started_at &&
    roster.length >= 4

  useEffect(() => {
    if (!needsStart || startingRef.current) return
    startingRef.current = true
    void (async () => {
      try {
        await supabase.rpc('start_competition', { p_session_id: sessionId })
        await refresh(true)
        onListRefresh?.()
      } finally {
        startingRef.current = false
      }
    })()
  }, [needsStart, sessionId, refresh, onListRefresh])

  const schedule = useMemo(() => americanoScheduleFromSession(session), [session])

  const roundTimesByGame = useMemo(() => {
    const map = new Map<number, { startsAt: number; endsAt: number }>()
    for (const round of rounds) {
      map.set(round.round_number, {
        startsAt: new Date(round.starts_at).getTime(),
        endsAt: new Date(round.ends_at).getTime(),
      })
    }
    if (map.size === 0 && session?.starts_at) {
      const games = rounds.length || schedule.totalGames
      for (let g = 1; g <= games; g += 1) {
        const slot = gameSlotTimes(
          session.starts_at,
          g,
          schedule.gameMinutes,
          schedule.breakMinutes,
        )
        map.set(g, { startsAt: slot.startsAt.getTime(), endsAt: slot.endsAt.getTime() })
      }
    }
    return map
  }, [rounds, session?.starts_at, schedule.gameMinutes, schedule.breakMinutes, schedule.totalGames])

  const roundStatusByGame = useMemo(() => {
    const map = new Map<number, 'pending' | 'active' | 'complete'>()
    for (const round of rounds) map.set(round.round_number, round.status)
    return map
  }, [rounds])

  const handleSubmitScores = useCallback(
    async (entries: CourtScoreSubmit[]) => {
      for (const entry of entries) {
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
      }
    },
    [applyMatchScore],
  )

  const started = Boolean(session?.competition_started_at)
  const finished = session?.status === 'complete'
  const hasRounds = rounds.length > 0
  const canScore = started && !finished && hasRounds
  const showBoard = columns.length > 0

  const handleSaved = useCallback(() => {
    void refresh(true)
    onListRefresh?.()
  }, [refresh, onListRefresh])

  if (loading && !session) {
    return <p className="py-4 text-center text-xs text-brand-muted">Loading courts…</p>
  }

  if (error && !session) {
    return <p className="py-4 text-center text-xs text-red-600">{error}</p>
  }

  if (!showBoard) {
    return (
      <p className="game-card px-3 py-4 text-center text-sm text-brand-muted">
        Loading court layout…
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="px-1 font-display text-sm font-semibold text-brand-primary">{title}</p>

      <CompetitionCourtBoard
        columns={columns}
        mode={hasRounds ? 'scoring' : 'preview'}
        activeGameNumber={activeRound?.round_number}
        scoreUnit={scoreUnit}
        playTo={playTo}
        liveCourtsByGame={liveCourtsByGame}
        roundIdForGame={roundIdForGame}
        courtIdByLabel={courtIdByLabel}
        canLog={canScore}
        matchForCourt={matchForCourt}
        onSubmitScores={handleSubmitScores}
        onSaved={handleSaved}
        now={now}
        gameMinutes={schedule.gameMinutes}
        roundTimesByGame={roundTimesByGame}
        roundStatusByGame={roundStatusByGame}
      />
    </div>
  )
}
