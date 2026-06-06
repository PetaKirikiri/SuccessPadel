import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CompetitionCourtScore } from '../components/CompetitionCourtScore'
import { CompetitionGuestRoster } from '../components/CompetitionGuestRoster'
import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { CompetitionMyCourt } from '../components/CompetitionMyCourt'
import {
  americanoScoringUnit,
  americanoTargetPoints,
  usesAmericanoScoring,
} from '../lib/competitionPresets'
import { formatClubTime } from '../lib/courtSchedule'
import { linkGuestRostersByEmail } from '../lib/authProfile'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import {
  matchWinnerTeam,
  roundPlayerName,
  useCompetitionRun,
  type RoundPlayer,
} from '../hooks/useCompetitionRun'

type CourtGroup = {
  courtId: string
  courtName: string
  a: string[]
  b: string[]
  playerIds: string[]
}

function groupByCourt(players: RoundPlayer[]): CourtGroup[] {
  const map = new Map<string, CourtGroup>()
  for (const p of players) {
    const name = p.courts?.name ?? 'Court'
    const row =
      map.get(p.court_id) ??
      ({ courtId: p.court_id, courtName: name, a: [], b: [], playerIds: [] } satisfies CourtGroup)
    const label = roundPlayerName(p)
    if (p.team === 'a') row.a.push(label)
    else row.b.push(label)
    const pid = p.profile_id ?? p.session_players?.profile_id
    if (pid) row.playerIds.push(pid)
    map.set(p.court_id, row)
  }
  return [...map.values()]
}

function canLogScores(
  isAdmin: boolean,
  whoCanLog: string,
  onRoster: boolean,
  userId: string | undefined,
  courtPlayerIds: string[],
): boolean {
  if (isAdmin) return true
  if (whoCanLog === 'any_member') return true
  if (whoCanLog === 'roster_members' && onRoster) return true
  if (userId && courtPlayerIds.includes(userId)) return true
  return false
}

export function CompetitionRun() {
  const { id } = useParams()
  const { profile, user } = useAuth()
  const {
    session,
    rounds,
    activeRound,
    courtMatches,
    roster,
    leaderboard,
    onRoster,
    loading,
    error,
    refresh,
  } = useCompetitionRun(id)
  const [busy, setBusy] = useState(false)
  const [startPhase, setStartPhase] = useState<'finalizing' | 'starting' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [advanceNotice, setAdvanceNotice] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const prevRoundNumber = useRef<number | null>(null)

  const isAdmin = Boolean(profile?.is_admin)
  const started = Boolean(session?.competition_started_at)
  const finished = session?.status === 'complete'
  const userId = user?.id

  useEffect(() => {
    void linkGuestRostersByEmail().then(() => refresh(true))
  }, [refresh])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!activeRound) return
    if (prevRoundNumber.current != null && activeRound.round_number > prevRoundNumber.current) {
      setAdvanceNotice(
        activeRound.is_final ? 'Final round — new courts assigned' : `Round ${activeRound.round_number} started`,
      )
      const t = setTimeout(() => setAdvanceNotice(null), 5000)
      prevRoundNumber.current = activeRound.round_number
      return () => clearTimeout(t)
    }
    prevRoundNumber.current = activeRound.round_number
  }, [activeRound])

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return '0:00'
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const timeLeft = useMemo(() => {
    if (!activeRound) return null
    return formatCountdown(new Date(activeRound.ends_at).getTime() - now)
  }, [activeRound, now])

  const eventTimeLeft = useMemo(() => {
    if (!session?.ends_at) return null
    return formatCountdown(new Date(session.ends_at).getTime() - now)
  }, [session?.ends_at, now])

  const courts = activeRound ? groupByCourt(activeRound.competition_round_players ?? []) : []

  const matchForCourt = (roundId: string, courtId: string) =>
    courtMatches.find((m) => m.competition_round_id === roundId && m.court_id === courtId)

  const start = async () => {
    if (!id) return
    setBusy(true)
    setActionError(null)
    setStartPhase('finalizing')
    await new Promise((r) => setTimeout(r, 500))
    setStartPhase('starting')
    const { error: err } = await supabase.rpc('start_competition', { p_session_id: id })
    setBusy(false)
    setStartPhase(null)
    if (err) setActionError(err.message)
    else void refresh()
  }

  const nextRound = async () => {
    if (!id) return
    setBusy(true)
    setActionError(null)
    const { error: err } = await supabase.rpc('advance_competition_round', { p_session_id: id })
    setBusy(false)
    if (err) setActionError(err.message)
    else void refresh()
  }

  if (loading) return <p className="py-6 text-center text-xs text-brand-muted">…</p>

  if (!session) {
    return <p className="py-6 text-center text-sm text-red-600">{error ?? 'Not found'}</p>
  }

  const scoreRound = activeRound ?? rounds.filter((r) => r.status === 'complete').at(-1)
  const isAmericano = usesAmericanoScoring(session)
  const scoreUnit = isAmericano ? americanoScoringUnit(session) : 'points'
  const playTo =
    isAmericano && scoreUnit !== 'open' ? americanoTargetPoints(session) : undefined
  const playerView = Boolean(started && activeRound && userId && onRoster && !isAdmin)
  const liveFocus = Boolean(started && activeRound && playerView)

  return (
    <div className={`pb-24 ${liveFocus ? 'space-y-4 pt-1' : 'space-y-3'}`}>
      <Link to="/competitions" className="text-sm text-brand-muted">
        ← Back
      </Link>

      {advanceNotice && (
        <p className="text-center text-sm text-brand-accent">{advanceNotice}</p>
      )}

      {!started && (
        <div className="game-card space-y-2 px-3 py-3">
          <p className="font-medium text-brand-primary">{session.title}</p>
          {session.starts_at && session.ends_at && (
            <p className="text-xs text-brand-muted">
              {formatClubTime(new Date(session.starts_at))}–{formatClubTime(new Date(session.ends_at))}
              {' · '}15 min rounds
            </p>
          )}
          {session.rules && <p className="text-sm text-brand-text">{session.rules}</p>}
        </div>
      )}

      {!started && isAdmin && id && (
        <>
          <CompetitionGuestRoster
            sessionId={id}
            session={session}
            roster={roster}
            isAdmin
            onRefresh={() => void refresh()}
          />
          <button
            type="button"
            disabled={busy || roster.length < 4}
            onClick={() => void start()}
            className="brand-btn w-full"
          >
            {startPhase === 'finalizing'
              ? 'Finalizing…'
              : startPhase === 'starting'
                ? 'Assigning courts…'
                : roster.length < 4
                  ? `Need ${4 - roster.length} more players`
                  : 'Start competition'}
          </button>
        </>
      )}

      {started && activeRound && playerView && userId && (
        <CompetitionMyCourt
          userId={userId}
          session={session}
          marginBonus={session.margin_bonus_enabled}
          activeRound={activeRound}
          courtMatches={courtMatches}
          timeLeft={timeLeft}
          eventTimeLeft={eventTimeLeft}
          onSaved={() => void refresh()}
        />
      )}

      {started && isAmericano && leaderboard.length > 0 && !liveFocus && (
        <CompetitionLeaderboard
          entries={leaderboard}
          compact={Boolean(activeRound)}
          scoreUnit={scoreUnit}
        />
      )}

      {started && activeRound && !playerView && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {activeRound.is_final ? 'Final — courts' : 'On court now'}
          </p>
          {!userId && (
            <p className="game-card px-3 py-3 text-sm text-brand-muted">
              Sign in with the email your admin used so you can see your court and enter scores.
            </p>
          )}
          {courts.length === 0 ? (
            <p className="game-card px-3 py-4 text-sm text-brand-muted">No court assignments.</p>
          ) : (
            courts.map((c) => {
              const saved = matchForCourt(activeRound.id, c.courtId)
              const savedParts = saved?.score_summary?.split('-').map((n) => Number(n.trim()))
              return (
                <CompetitionCourtScore
                  key={c.courtId}
                  roundId={activeRound.id}
                  courtId={c.courtId}
                  courtName={c.courtName}
                  teamA={c.a}
                  teamB={c.b}
                  isAmericano={isAmericano}
                  playTo={playTo}
                  scoreUnit={scoreUnit}
                  savedScore={saved?.score_summary}
                  savedTeamAPoints={isAmericano ? savedParts?.[0] : undefined}
                  savedTeamBPoints={isAmericano ? savedParts?.[1] : undefined}
                  savedWinner={saved ? matchWinnerTeam(saved) : undefined}
                  canLog={canLogScores(
                    isAdmin,
                    session.who_can_log_matches,
                    onRoster,
                    userId,
                    c.playerIds,
                  )}
                  showMargin={session.margin_bonus_enabled && !isAmericano}
                  onSaved={() => void refresh()}
                />
              )
            })
          )}

          {isAdmin && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void nextRound()}
              className="brand-btn-outline w-full"
            >
              {activeRound.is_final ? 'Finish' : 'Next round'}
            </button>
          )}
        </div>
      )}

      {started && !activeRound && (
        <div className="space-y-2">
          <div className="game-card space-y-2 px-3 py-4 text-center">
            <p className="text-sm font-medium text-brand-primary">
              {finished ? 'Competition complete' : 'Round break'}
            </p>
            {finished && leaderboard.length > 0 && (
              <p className="text-sm text-brand-accent">
                Winner: {leaderboard[0].display_name} ({leaderboard[0].total_points}{' '}
                {scoreUnit === 'sets' ? 'sets' : 'pts'})
              </p>
            )}
            <Link to="/" className="text-xs text-brand-muted">
              View season leaderboard →
            </Link>
          </div>

          {isAmericano && leaderboard.length > 0 && (
            <CompetitionLeaderboard entries={leaderboard} scoreUnit={scoreUnit} />
          )}

          {scoreRound &&
            groupByCourt(scoreRound.competition_round_players ?? []).map((c) => {
              const saved = matchForCourt(scoreRound.id, c.courtId)
              const savedParts = saved?.score_summary?.split('-').map((n) => Number(n.trim()))
              return (
                <CompetitionCourtScore
                  key={c.courtId}
                  roundId={scoreRound.id}
                  courtId={c.courtId}
                  courtName={c.courtName}
                  teamA={c.a}
                  teamB={c.b}
                  isAmericano={isAmericano}
                  playTo={playTo}
                  scoreUnit={scoreUnit}
                  savedScore={saved?.score_summary}
                  savedTeamAPoints={isAmericano ? savedParts?.[0] : undefined}
                  savedTeamBPoints={isAmericano ? savedParts?.[1] : undefined}
                  savedWinner={saved ? matchWinnerTeam(saved) : undefined}
                  canLog={false}
                  showMargin={false}
                  onSaved={() => void refresh()}
                />
              )
            })}
        </div>
      )}

      {rounds.length > 0 && !liveFocus && (
        <div className="game-card px-3 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Rounds</p>
          <ul className="m-0 list-none space-y-1 p-0 text-xs text-brand-muted">
            {rounds.map((r) => (
              <li key={r.id}>
                {r.is_final ? 'Final' : `R${r.round_number}`}{' '}
                {formatClubTime(new Date(r.starts_at))}–{formatClubTime(new Date(r.ends_at))}{' '}
                <span className="text-brand-accent">{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(error || actionError) && (
        <p className="text-center text-sm text-red-600">{actionError ?? error}</p>
      )}
    </div>
  )
}
