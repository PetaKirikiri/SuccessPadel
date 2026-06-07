import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CompetitionCourtScore } from '../components/CompetitionCourtScore'
import { CompetitionGuestRoster } from '../components/CompetitionGuestRoster'
import { CompetitionCourtBoard } from '../components/CompetitionCourtBoard'
import { CompetitionLayoutPreview } from '../components/CompetitionLayoutPreview'
import { compareSchedules } from '../lib/competitionScheduleCompare'
import { competitionScheduleDebugLog } from '../lib/debug/competitionScheduleDebug'
import { pivotScheduleByCourt } from '../lib/competitionCourtBoard'
import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { CompetitionMyCourt } from '../components/CompetitionMyCourt'
import { gamesFromDbRounds } from '../hooks/useCompetitionBoard'
import {
  americanoScoringUnit,
  americanoTargetPoints,
  usesAmericanoScoring,
} from '../lib/competitionPresets'
import {
  americanoScheduleFromSession,
  courtsNeeded,
  isValidCourtLayout,
  RANKED_GAME_MINUTES,
} from '../lib/competitionLayout'
import { solveBalancedSchedule } from '../lib/balancedSchedule'
import {
  buildStoredSchedule,
  planRankedSchedule,
  RANKED_SCHEDULE_VERSION,
  scheduleSeedFromSession,
  sortRosterByRank,
  type StoredScheduleRound,
} from '../lib/rankedSchedule'
import { formatClubTime } from '../lib/courtSchedule'
import { linkGuestRostersByEmail } from '../lib/authProfile'
import { competitionPlayUrl } from '../lib/siteUrl'
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
  teamAIds: (string | null)[]
  teamBIds: (string | null)[]
  teamAAvatars: (string | null)[]
  teamBAvatars: (string | null)[]
}

function groupByCourt(players: RoundPlayer[]): CourtGroup[] {
  const map = new Map<string, CourtGroup>()
  for (const p of players) {
    const name = p.courts?.name ?? 'Court'
    const row =
      map.get(p.court_id) ??
      ({
        courtId: p.court_id,
        courtName: name,
        a: [],
        b: [],
        playerIds: [],
        teamAIds: [],
        teamBIds: [],
        teamAAvatars: [],
        teamBAvatars: [],
      } satisfies CourtGroup)
    const label = roundPlayerName(p)
    const pid = p.profile_id ?? p.session_players?.profile_id
    const avatarUrl = p.session_players?.profiles?.avatar_url ?? null
    if (p.team === 'a') {
      row.a.push(label)
      row.teamAIds.push(pid ?? null)
      row.teamAAvatars.push(avatarUrl)
    } else {
      row.b.push(label)
      row.teamBIds.push(pid ?? null)
      row.teamBAvatars.push(avatarUrl)
    }
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
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const {
    session,
    rounds,
    activeRound,
    courtMatches,
    roster,
    clubCourts,
    leaderboard,
    onRoster,
    loading,
    error,
    refresh,
  } = useCompetitionRun(id)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [scheduleSeed, setScheduleSeed] = useState(0)
  const [advanceNotice, setAdvanceNotice] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [copied, setCopied] = useState(false)
  const prevRoundNumber = useRef<number | null>(null)

  const isAdmin = Boolean(profile?.is_admin)
  const started = Boolean(session?.competition_started_at)
  const finished = session?.status === 'complete'
  const userId = user?.id
  const isAmericano = session ? usesAmericanoScoring(session) : false
  const guestLeaderboardProps = {
    currentUserId: userId ?? null,
    competitionId: id ?? null,
  }

  useEffect(() => {
    void linkGuestRostersByEmail().then(() => refresh(true))
  }, [refresh])

  useEffect(() => {
    setScheduleSeed(scheduleSeedFromSession(session?.scoring_config))
  }, [session?.scoring_config, session?.id])

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

  const liveCourtsByGame = useMemo(() => {
    const map = new Map<
      number,
      {
        courtId: string
        courtName: string
        teamA: string[]
        teamB: string[]
        playerIds: string[]
        teamAIds: (string | null)[]
        teamBIds: (string | null)[]
        teamAAvatars: (string | null)[]
        teamBAvatars: (string | null)[]
      }[]
    >()
    for (const round of rounds) {
      const groups = groupByCourt(round.competition_round_players ?? [])
      if (groups.length === 0) continue
      map.set(
        round.round_number,
        groups.map((c) => ({
          courtId: c.courtId,
          courtName: c.courtName,
          teamA: c.a,
          teamB: c.b,
          playerIds: c.playerIds,
          teamAIds: c.teamAIds,
          teamBIds: c.teamBIds,
          teamAAvatars: c.teamAAvatars,
          teamBAvatars: c.teamBAvatars,
        })),
      )
    }
    return map
  }, [rounds])

  const roundIdForGame = useCallback(
    (gameNumber: number) => rounds.find((r) => r.round_number === gameNumber)?.id,
    [rounds],
  )

  const roundTimesByGame = useMemo(() => {
    const map = new Map<number, { startsAt: number; endsAt: number }>()
    for (const round of rounds) {
      map.set(round.round_number, {
        startsAt: new Date(round.starts_at).getTime(),
        endsAt: new Date(round.ends_at).getTime(),
      })
    }
    return map
  }, [rounds])

  const roundStatusByGame = useMemo(() => {
    const map = new Map<number, 'pending' | 'active' | 'complete'>()
    for (const round of rounds) map.set(round.round_number, round.status)
    return map
  }, [rounds])

  const neededCourts = courtsNeeded(roster.length)

  const courtNames = useMemo(
    () => clubCourts.slice(0, neededCourts).map((c) => c.name),
    [clubCourts, neededCourts],
  )

  const layoutValid = isValidCourtLayout(roster.length)
  const rankedRoster = useMemo(() => sortRosterByRank(roster), [roster])
  const { totalGames, gameMinutes: scheduledGameMinutes } = americanoScheduleFromSession(session)
  const gameMinutes = isAmericano ? scheduledGameMinutes : 0

  const reviewFromDb = finished && rounds.length > 0

  const americanoGames = useMemo(() => {
    if (!isAmericano) return []
    if (reviewFromDb) return gamesFromDbRounds(rounds, clubCourts)
    if (!layoutValid) return []
    return planRankedSchedule(rankedRoster, courtNames, totalGames, scheduleSeed)
  }, [
    isAmericano,
    reviewFromDb,
    rounds,
    clubCourts,
    layoutValid,
    rankedRoster,
    courtNames,
    scheduleSeed,
    totalGames,
  ])

  const courtBoardColumns = useMemo(() => {
    if (!isAmericano || americanoGames.length === 0) return []
    if (!gameMinutes && !reviewFromDb) return []
    return pivotScheduleByCourt(
      americanoGames,
      session?.starts_at ?? undefined,
      gameMinutes || RANKED_GAME_MINUTES,
    )
  }, [americanoGames, gameMinutes, isAmericano, reviewFromDb, session?.starts_at])

  const scheduleComparison = useMemo(
    () => compareSchedules(liveCourtsByGame, americanoGames),
    [liveCourtsByGame, americanoGames],
  )

  useEffect(() => {
    if (!isAdmin || americanoGames.length === 0) return
    competitionScheduleDebugLog(
      'CompetitionRun.tsx:scheduleCompare',
      'db vs preview matchups',
      'schedule-compare',
      {
        scheduleVersion: RANKED_SCHEDULE_VERSION,
        started,
        competitionId: id,
        activeRound: activeRound?.round_number ?? null,
        playerCount: roster.length,
        courtCount: neededCourts,
        scheduleSeed,
        dbGamesWithData: scheduleComparison.dbGamesWithData,
        dbCourt1Unique: scheduleComparison.dbCourt1Unique,
        previewCourt1Unique: scheduleComparison.previewCourt1Unique,
        duplicateDbCourt1: scheduleComparison.duplicateDbCourt1,
        mismatchCount: scheduleComparison.mismatches.length,
        court1Preview: scheduleComparison.court1Preview,
        court1Db: scheduleComparison.court1Db,
      },
    )
  }, [
    isAdmin,
    americanoGames.length,
    scheduleComparison,
    started,
    id,
    activeRound?.round_number,
    roster.length,
  ])

  const matchForCourt = (roundId: string, courtId: string) =>
    courtMatches.find((m) => m.competition_round_id === roundId && m.court_id === courtId)

  const nextRound = async () => {
    if (!id) return
    setBusy(true)
    setActionError(null)
    const { error: err } = await supabase.rpc('advance_competition_round', { p_session_id: id })
    setBusy(false)
    if (err) setActionError(err.message)
    else void refresh()
  }

  const buildSchedulePayload = (seed: number): StoredScheduleRound[] => {
    const ranked = sortRosterByRank(roster)
    const rounds = solveBalancedSchedule(ranked.length, totalGames, seed)
    return buildStoredSchedule(ranked, rounds)
  }

  const persistScheduleConfig = async (seed: number) => {
    if (!id || !session) return
    const schedule = layoutValid ? buildSchedulePayload(seed) : []
    const nextConfig = {
      ...(session.scoring_config ?? {}),
      schedule_seed: seed,
      schedule_version: RANKED_SCHEDULE_VERSION,
      schedule,
    }
    const { error: err } = await supabase
      .from('game_sessions')
      .update({ scoring_config: nextConfig })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setScheduleSeed(seed)
  }

  const rebuildSchedule = async () => {
    if (!id) return
    setBusy(true)
    setActionError(null)
    try {
      await persistScheduleConfig(scheduleSeed)
      const { error: err } = await supabase.rpc('rebuild_competition_schedule', {
        p_session_id: id,
      })
      if (err) throw new Error(err.message)
      void refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Rebuild failed')
    }
    setBusy(false)
  }

  const startCompetition = async () => {
    if (!id) return
    setBusy(true)
    setActionError(null)
    try {
      await persistScheduleConfig(scheduleSeed)
      const { error: err } = await supabase.rpc('start_competition', { p_session_id: id })
      if (err) throw new Error(err.message)
      navigate(`/competitions/${id}`)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Start failed')
    }
    setBusy(false)
  }

  if (loading) return <p className="py-6 text-center text-xs text-brand-muted">…</p>

  if (!session) {
    return <p className="py-6 text-center text-sm text-red-600">{error ?? 'Not found'}</p>
  }

  const scoreUnit = isAmericano ? americanoScoringUnit(session) : 'points'
  const playTo =
    isAmericano && scoreUnit !== 'open' ? americanoTargetPoints(session) : undefined
  const playerFocus = Boolean(!isAdmin && started && userId)
  const liveFocus = Boolean(playerFocus && activeRound)

  return (
    <div className={`pb-24 ${liveFocus ? 'space-y-4 pt-1' : 'space-y-3'}`}>
      <Link to="/competitions" className="text-sm text-brand-muted">
        ← Back
      </Link>

      {advanceNotice && (
        <p className="text-center text-sm text-brand-accent">{advanceNotice}</p>
      )}

      {started && isAdmin && id && (
        <div className="game-card flex items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              Player game link
            </p>
            <Link to={`/competitions/${id}`} className="block truncate text-xs text-brand-accent">
              {competitionPlayUrl(id)}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(competitionPlayUrl(id))
                .then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                })
            }}
            className="brand-btn-outline shrink-0 text-xs"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
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

          {isAmericano && layoutValid && americanoGames.length > 0 && (
            <CompetitionLayoutPreview
              session={session}
              games={americanoGames}
              eventStartsAt={session.starts_at ?? undefined}
              gameMinutes={gameMinutes}
            />
          )}

          {roster.length >= 4 ? (
            <button
              type="button"
              disabled={busy || !layoutValid}
              onClick={() => void startCompetition()}
              className="brand-btn w-full py-4 text-lg font-semibold"
            >
              {busy ? 'Saving…' : 'Accept & go live'}
            </button>
          ) : (
            <p className="text-center text-sm text-brand-muted">Need at least 4 players to start.</p>
          )}
        </>
      )}

      {!started && !isAdmin && (
        <p className="game-card px-3 py-6 text-center text-sm text-brand-muted">
          Waiting for the organiser to start.
        </p>
      )}

      {started && activeRound && !userId && !isAdmin && (
        <p className="game-card px-3 py-6 text-center text-sm text-brand-muted">
          Sign in to see your court and enter your score.
        </p>
      )}

      {started && activeRound && playerFocus && userId && (
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

      {started && isAmericano && leaderboard.length > 0 && !liveFocus && isAdmin && (
        <CompetitionLeaderboard
          entries={leaderboard}
          compact={Boolean(activeRound)}
          scoreUnit={scoreUnit}
          {...guestLeaderboardProps}
        />
      )}

      {started && activeRound && isAdmin && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              {activeRound.is_final ? 'Final' : `Game ${activeRound.round_number}`}
            </p>
            {timeLeft && (
              <p className="text-xs tabular-nums text-brand-accent">{timeLeft} left</p>
            )}
          </div>
          {courts.length === 0 ? (
            <p className="game-card px-3 py-4 text-sm text-brand-muted">No court assignments.</p>
          ) : isAmericano && courtBoardColumns.length > 0 ? (
            <div className="game-card px-2 py-3">
              <CompetitionCourtBoard
                columns={courtBoardColumns}
                mode="scoring"
                activeGameNumber={activeRound.round_number}
                scoreUnit={scoreUnit}
                playTo={playTo}
                liveCourtsByGame={liveCourtsByGame}
                roundIdForGame={roundIdForGame}
                canLog={isAdmin}
                matchForCourt={(roundId, courtId) => {
                  const saved = matchForCourt(roundId, courtId)
                  if (!saved) return undefined
                  const parts = saved.score_summary?.split('-').map((n) => Number(n.trim()))
                  return {
                    score_summary: saved.score_summary,
                    teamAPoints: parts?.[0],
                    teamBPoints: parts?.[1],
                    winner: matchWinnerTeam(saved),
                  }
                }}
                onSaved={() => void refresh()}
                gameMinutes={gameMinutes}
                currentUserId={userId ?? null}
                currentUserAvatarUrl={profile?.avatar_url ?? null}
              />
            </div>
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
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void rebuildSchedule()}
                className="brand-btn-outline w-full text-sm"
              >
                Refresh court layout
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void nextRound()}
                className="brand-btn-outline w-full"
              >
                {activeRound.is_final ? 'Finish' : 'Next round'}
              </button>
            </div>
          )}
        </div>
      )}

      {started && !activeRound && (
        <div className="space-y-2">
          {isAdmin && !finished && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void rebuildSchedule()}
              className="brand-btn-outline w-full text-sm"
            >
              Refresh court layout
            </button>
          )}
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

          {isAmericano && courtBoardColumns.length > 0 && (
            <div className="game-card px-2 py-3">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                All games
              </p>
              <CompetitionCourtBoard
                columns={courtBoardColumns}
                mode="scoring"
                scoreUnit={scoreUnit}
                playTo={playTo}
                liveCourtsByGame={liveCourtsByGame}
                roundIdForGame={roundIdForGame}
                canLog={false}
                matchForCourt={(roundId, courtId) => {
                  const saved = matchForCourt(roundId, courtId)
                  if (!saved) return undefined
                  const parts = saved.score_summary?.split('-').map((n) => Number(n.trim()))
                  return {
                    score_summary: saved.score_summary,
                    teamAPoints: parts?.[0],
                    teamBPoints: parts?.[1],
                    winner: matchWinnerTeam(saved),
                  }
                }}
                now={now}
                gameMinutes={gameMinutes}
                roundTimesByGame={roundTimesByGame}
                roundStatusByGame={roundStatusByGame}
                currentUserId={userId ?? null}
                currentUserAvatarUrl={profile?.avatar_url ?? null}
              />
            </div>
          )}

          {leaderboard.length > 0 && (isAdmin || finished) && (
            <CompetitionLeaderboard
              entries={leaderboard}
              scoreUnit={scoreUnit}
              {...guestLeaderboardProps}
            />
          )}
        </div>
      )}

      {rounds.length > 0 && !liveFocus && isAdmin && (
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
