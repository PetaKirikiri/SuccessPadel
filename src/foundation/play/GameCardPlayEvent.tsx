import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ensureCompetitionScheduleSaved } from '../../lib/persistCompetitionSchedule'
import { GameBoard } from '../../components/GameCard/GameBoard'
import { Leaderboard } from '../../components/leaderboard'
import { PlayStandardView } from './PlayStandardView'
import { PlayTvView } from './PlayTvView'
import type { PlayViewTab } from '../../foundation/play/PlayViewTabs'
import { useAuth } from '../../hooks/useAuth'
import { useIsTvLayout } from '../../hooks/useIsTvLayout'
import { useViewportBucket } from '../../hooks/useGameCardSize'
import { useCompetitionLiveCourtScores } from '../../hooks/useCompetitionLiveCourtScores'
import { useCourtEphemeralScores } from '../../hooks/useCourtEphemeralScores'
import { useLatchedLiveCourtDisplay } from '../../hooks/useLatchedLiveCourtDisplay'
import { useCompetitionBoard } from '../../hooks/useCompetitionBoard'
import { useLineClientProfile } from '../../hooks/useLineClientProfile'
import { usePublicCompetition } from '../../hooks/usePublicCompetition'
import {
  calculateCompetitionAchievements,
  calculateLiveAchievements,
  isCompetitionComplete,
} from '../../lib/competitionAchievements'
import { americanoScheduleFromSession, competitionRoundTimesByGame } from '../../lib/competitionLayout'
import type { CourtScoreSubmit } from '../../lib/competitionScoreInput'
import { computeAmericanoStandings } from '../../lib/competitionStandings'
import { computeDuoStandings } from '../../lib/computeDuoStandings'
import { computeFriendlySessionStandings } from '../../lib/friendlySessionStandings'
import { duoLabelsForMatch } from '../../lib/competitionFormatPresets'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import { buildRosterNameById } from '../../hooks/useCompetitions'
import { useTranslation } from '../../hooks/useTranslation'
import { enrichStandingsWithAvatars } from '../../lib/leaderboardEntries'
import { competitionViewAlongUrl } from '../../lib/siteUrl'
import { supabase } from '../../lib/supabaseClient'
import { pivotScheduleByGame } from '../../lib/competitionCourtBoard'
import { competitionCourtSetupKey } from '../../lib/gestureCameraScore'
import { agentDebugIngest } from '../../lib/debug/devDebug'
import { americanoCourtTotals } from '../../lib/friendlyManualScore'
import { ensureCompetitionRoundId } from '../../lib/competitionRoundResolve'
import type { TennisScore } from '../../lib/tennisScore'
import {
  computeManualCourtStandings,
  manualCourtScoreKey,
  type ManualCourtScore,
} from '../../lib/competitionManualStandings'

type PlayTab = PlayViewTab

function scoreTotalsForUnit(score: TennisScore, scoreUnit: string): [number, number] {
  if (scoreUnit === 'points') return [score.pointsA ?? 0, score.pointsB ?? 0]
  return [score.gamesA ?? 0, score.gamesB ?? 0]
}

function ephemeralScoreToCourtScore(
  sourceKey: string,
  score: TennisScore,
  {
    competitionId,
    courtIdByLabel,
    scoreUnit,
  }: {
    competitionId?: string
    courtIdByLabel: Map<string, string>
    scoreUnit: string
  },
): ManualCourtScore | null {
  const keyed = sourceKey.match(/^(\d+):(.+)$/)
  if (keyed) {
    const gameNumber = Number(keyed[1])
    const courtKey = keyed[2]!
    const courtId = courtIdByLabel.get(courtKey) ?? courtKey
    const [teamA, teamB] = scoreTotalsForUnit(score, scoreUnit)
    return Number.isFinite(gameNumber) ? { gameNumber, courtId, teamA, teamB } : null
  }

  if (!competitionId || !sourceKey.startsWith(`${competitionId}-`)) return null
  const rest = sourceKey.slice(competitionId.length + 1)
  const splitAt = rest.indexOf('-')
  if (splitAt <= 0) return null
  const gameNumber = Number(rest.slice(0, splitAt))
  const courtId = rest.slice(splitAt + 1)
  if (!Number.isFinite(gameNumber) || !courtId) return null
  const [teamA, teamB] = scoreTotalsForUnit(score, scoreUnit)
  return { gameNumber, courtId, teamA, teamB }
}

export function GameCardPlayEvent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const isAdmin = Boolean(user && profile?.is_admin)
  const isTvLayout = useIsTvLayout()
  const viewport = useViewportBucket()
  const hasSideLeaderboard = isTvLayout || viewport === 'web'
  const [tab, setTab] = useState<PlayTab>(() =>
    searchParams.get('view') === 'leaderboard' ? 'leaderboard' : 'games',
  )
  const autoStartAttemptedRef = useRef<string | null>(null)
  const scheduleMigrationAttemptedRef = useRef<string | null>(null)
  const competitionScoreSaveQueueRef = useRef(new Map<string, Promise<void>>())
  const [, setTvGameNumber] = useState<number | undefined>(undefined)
  const [manualCourtScores, setManualCourtScores] = useState<Map<string, ManualCourtScore>>(
    () => new Map(),
  )

  const {
    session,
    rounds,
    activeRound,
    courtMatches,
    roster,
    clubCourts,
    leaderboard,
    sessionPairs,
    loading,
    error,
    refresh,
    applyMatchScore,
  } = usePublicCompetition(id, {
    pollMs: 20_000,
  })
  const { columns, liveCourtsByGame, roundIdForGame, courtIdByLabel, scoreUnit, playTo, matchForCourt, isDuo, teams } =
    useCompetitionBoard(session, rounds, roster, clubCourts, courtMatches, sessionPairs, leaderboard)
  const courtIdToLabel = useMemo(() => {
    const map = new Map<string, string>()
    for (const [label, courtId] of courtIdByLabel) map.set(courtId, label)
    for (const courts of liveCourtsByGame.values()) {
      for (const court of courts) map.set(court.courtId, court.courtName)
    }
    return map
  }, [courtIdByLabel, liveCourtsByGame])
  const started = Boolean(session?.competition_started_at)
  const canScore = Boolean(session)
  const receiverPollMs = 0
  const { scores: liveCourtScores, feeds: liveCourtFeeds, logs: gestureLogs, applyGestureLog } = useCompetitionLiveCourtScores(
    id,
    courtIdToLabel,
    scoreUnit,
    receiverPollMs,
  )

  const courtSetupKeys = useMemo(() => {
    if (!id) return []
    const keys = new Set<string>()
    for (const game of pivotScheduleByGame(columns)) {
      for (const court of game.courts) {
        const courtId = courtIdByLabel.get(court.courtLabel)
        if (courtId) keys.add(competitionCourtSetupKey(id, game.gameNumber, courtId))
      }
    }
    for (const [gameNumber, courts] of liveCourtsByGame) {
      for (const court of courts) {
        keys.add(competitionCourtSetupKey(id, gameNumber, court.courtId))
      }
    }
    return [...keys]
  }, [columns, courtIdByLabel, id, liveCourtsByGame, started])

  const ephemeralScores = useCourtEphemeralScores(courtSetupKeys)

  const { feeds: mergedLiveCourtFeeds, scores: mergedLiveCourtScores } = useLatchedLiveCourtDisplay(
    liveCourtFeeds,
    liveCourtScores,
    ephemeralScores,
    courtIdToLabel,
    scoreUnit,
  )

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (tab === 'leaderboard') void refresh(true)
  }, [tab, refresh])

  const schedule = useMemo(
    () => americanoScheduleFromSession(session),
    [session, sessionPairs?.length],
  )

  const rosterNameById = useMemo(
    () => buildRosterNameById(roster, leaderboard),
    [roster, leaderboard],
  )

  const duoTeamLabels = useCallback(
    (
      teamA: [string, string],
      teamB: [string, string],
      teamAPlayers?: CourtPlayer[],
      teamBPlayers?: CourtPlayer[],
    ) =>
      duoLabelsForMatch(
        teams,
        rosterNameById,
        teamA,
        teamB,
        teamAPlayers?.map((player) => player.rosterId ?? null),
        teamBPlayers?.map((player) => player.rosterId ?? null),
      ),
    [teams, rosterNameById],
  )

  const scheduleRoster = useMemo(() => {
    const seen = new Set<string>()
    const players: CourtPlayer[] = []
    for (const game of pivotScheduleByGame(columns)) {
      for (const court of game.courts) {
        for (const player of [...(court.teamAPlayers ?? []), ...(court.teamBPlayers ?? [])]) {
          const key = player.rosterId ?? player.id ?? player.name
          if (!key || seen.has(key)) continue
          seen.add(key)
          players.push(player)
        }
      }
    }
    return players
  }, [columns])

  const liveCourtScoreOverrides = useMemo(() => {
    const dbCourtScores = new Map<string, ManualCourtScore>()
    for (const match of courtMatches) {
      const round = rounds.find((row) => row.id === match.competition_round_id)
      const parts = match.score_summary?.split('-').map((score) => Number(score.trim()))
      if (!round || !match.court_id || !parts || parts.length !== 2) continue
      const [teamA, teamB] = parts
      if (!Number.isFinite(teamA) || !Number.isFinite(teamB)) continue
      dbCourtScores.set(manualCourtScoreKey(round.round_number, match.court_id), {
        gameNumber: round.round_number,
        courtId: match.court_id,
        teamA: teamA!,
        teamB: teamB!,
      })
    }

    const gestureCourtScores = new Map<string, ManualCourtScore>()
    for (const log of gestureLogs) {
      const gameNumber = Number(log.gameNumber)
      if (!Number.isFinite(gameNumber) || !log.courtId || !log.finalScore) continue
      const [teamA, teamB] = americanoCourtTotals(log.finalScore, scoreUnit)
      if (teamA === 0 && teamB === 0 && log.pointEvents.length === 0) continue
      gestureCourtScores.set(manualCourtScoreKey(gameNumber, log.courtId), {
        gameNumber,
        courtId: log.courtId,
        teamA,
        teamB,
      })
    }

    const ephemeralCourtScores = new Map<string, ManualCourtScore>()
    for (const [sourceKey, score] of ephemeralScores) {
      const courtScore = ephemeralScoreToCourtScore(sourceKey, score, {
        competitionId: id,
        courtIdByLabel,
        scoreUnit,
      })
      if (!courtScore) continue
      if (courtScore.teamA === 0 && courtScore.teamB === 0) continue
      ephemeralCourtScores.set(
        manualCourtScoreKey(courtScore.gameNumber, courtScore.courtId),
        courtScore,
      )
    }

    return new Map([...dbCourtScores, ...gestureCourtScores, ...ephemeralCourtScores, ...manualCourtScores])
  }, [courtIdByLabel, courtMatches, ephemeralScores, gestureLogs, id, manualCourtScores, rounds, scoreUnit])

  const effectiveCourtMatches = useMemo(() => {
    if (liveCourtScoreOverrides.size === 0) return courtMatches
    const next = [...courtMatches]
    for (const score of liveCourtScoreOverrides.values()) {
      const roundId = roundIdForGame(score.gameNumber)
      if (!roundId) continue
      const scoreSummary = `${score.teamA}-${score.teamB}`
      const playedAt = new Date().toISOString()
      const index = next.findIndex(
        (match) => match.competition_round_id === roundId && match.court_id === score.courtId,
      )
      if (index >= 0) {
        next[index] = {
          ...next[index]!,
          score_summary: scoreSummary,
          played_at: next[index]!.played_at ?? playedAt,
        }
      } else {
        next.push({
          competition_round_id: roundId,
          court_id: score.courtId,
          score_summary: scoreSummary,
          played_at: playedAt,
          match_players: [],
        })
      }
    }
    return next
  }, [courtMatches, liveCourtScoreOverrides, roundIdForGame])

  const effectivePlayerStandings = useMemo(
    () =>
      enrichStandingsWithAvatars(
        computeAmericanoStandings(roster, rounds, effectiveCourtMatches),
        leaderboard,
      ),
    [effectiveCourtMatches, leaderboard, roster, rounds],
  )

  const effectiveDuoStandings = useMemo(
    () =>
      isDuo && teams.length >= 2
        ? enrichStandingsWithAvatars(
            computeDuoStandings(roster, rounds, effectiveCourtMatches, teams),
            leaderboard,
          )
        : [],
    [effectiveCourtMatches, isDuo, leaderboard, roster, rounds, teams],
  )

  const gestureStandings = useMemo(
    () => computeFriendlySessionStandings(gestureLogs, scoreUnit, scheduleRoster),
    [gestureLogs, scoreUnit, scheduleRoster],
  )

  const manualStandings = useMemo(
    () =>
      computeManualCourtStandings({
        scores: liveCourtScoreOverrides,
        columns,
        courtIdByLabel,
        isDuo,
        teams,
        roster,
      }),
    [columns, courtIdByLabel, isDuo, liveCourtScoreOverrides, roster, teams],
  )

  const liveStandings = useMemo(() => {
    if (manualStandings.length > 0) {
      return enrichStandingsWithAvatars(manualStandings, leaderboard)
    }
    if (isDuo && teams.length >= 2 && effectiveDuoStandings.length > 0) {
      return effectiveDuoStandings
    }
    if (!isDuo && effectivePlayerStandings.length > 0) {
      return effectivePlayerStandings
    }
    if (leaderboard.length > 0) {
      return leaderboard
    }
    return enrichStandingsWithAvatars(gestureStandings, leaderboard)
  }, [
    effectiveDuoStandings,
    effectivePlayerStandings,
    gestureStandings,
    isDuo,
    leaderboard,
    manualStandings,
    rounds,
    teams,
  ])

  const roundTimesByGame = useMemo(
    () =>
      competitionRoundTimesByGame(
        session,
        Math.max(rounds.length, schedule.totalGames),
        rounds,
      ),
    [session, rounds, schedule.totalGames],
  )

  const roundStatusByGame = useMemo(() => {
    const map = new Map<number, 'pending' | 'active' | 'complete'>()
    for (const round of rounds) map.set(round.round_number, round.status)
    return map
  }, [rounds])

  const handleSubmitScores = useCallback(
    async (entries: CourtScoreSubmit[], label?: string) => {
      for (const entry of entries) {
        const saveKey = `${entry.roundId}:${entry.courtId}`
        const priorSave =
          competitionScoreSaveQueueRef.current.get(saveKey) ?? Promise.resolve()
        const save = priorSave.catch(() => undefined).then(async () => {
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
          // #region agent log
          agentDebugIngest(
            'LB',
            err
              ? `③ RPC failed — ${err.message}`
              : `③ RPC saved ${entry.teamA}-${entry.teamB}${label ? ` (${label})` : ''}`,
            { roundId: entry.roundId, courtId: entry.courtId },
            'LB',
            '5d6061',
          )
          // #endregion
          if (err) throw new Error(err.message)
          applyMatchScore(entry.roundId, entry.courtId, `${entry.teamA}-${entry.teamB}`)
          await refresh(true)
        })
        competitionScoreSaveQueueRef.current.set(saveKey, save)
        try {
          await save
        } finally {
          if (competitionScoreSaveQueueRef.current.get(saveKey) === save) {
            competitionScoreSaveQueueRef.current.delete(saveKey)
          }
        }
      }
    },
    [applyMatchScore, refresh],
  )

  const resolveCompetitionRoundId = useCallback(
    async (gameNumber: number): Promise<string | undefined> => {
      const cached = roundIdForGame(gameNumber)
      if (cached) return cached
      if (!id || !session) return undefined
      const result = await ensureCompetitionRoundId(id, gameNumber, {
        session,
        roster,
        sessionPairs,
      })
      if (result.started) await refresh(true)
      return result.roundId
    },
    [id, refresh, roster, roundIdForGame, session, sessionPairs],
  )

  const handleCompetitionCourtGamesSaved = useCallback(
    async (
      gameNumber: number,
      courtId: string,
      teamA: number,
      teamB: number,
      courtLabel?: string,
    ) => {
      setManualCourtScores((prev) => {
        const next = new Map(prev)
        next.set(manualCourtScoreKey(gameNumber, courtId), { gameNumber, courtId, teamA, teamB })
        return next
      })

      const roundId = await resolveCompetitionRoundId(gameNumber)
      if (roundId) {
        await handleSubmitScores(
          [{ roundId, courtId, teamA, teamB }],
          courtLabel ?? `game ${gameNumber}`,
        )
      }

      const preview = computeManualCourtStandings({
        scores: new Map([
          ...manualCourtScores,
          [manualCourtScoreKey(gameNumber, courtId), { gameNumber, courtId, teamA, teamB }],
        ]),
        columns,
        courtIdByLabel,
        isDuo,
        teams,
        roster,
      })
      const top = preview.slice(0, 4).map((row) => ({
        name: row.display_name,
        pts: row.total_points,
        wins: row.wins,
      }))
      // #region agent log
      agentDebugIngest(
        'LB',
        `④ leaderboard — top: ${top.map((r) => `${r.name}=${r.pts}pt`).join(', ') || 'empty'}${roundId ? ' (RPC)' : ' (local)'}`,
        { gameNumber, courtId, teamA, teamB, hadRoundId: Boolean(roundId), top },
        'LB',
        '5d6061',
      )
      // #endregion
    },
    [
      columns,
      courtIdByLabel,
      handleSubmitScores,
      isDuo,
      manualCourtScores,
      resolveCompetitionRoundId,
      roster,
      teams,
    ],
  )

  const handleGestureGamesSynced = useCallback(
    async (log: import('../../lib/matchLogServer').MatchGestureLog) => {
      applyGestureLog(log)
      const gameNumber = Number(log.gameNumber)
      const [teamA, teamB] = log.finalScore
        ? americanoCourtTotals(log.finalScore, scoreUnit)
        : [0, 0]
      if (log.courtId) {
        setManualCourtScores((prev) => {
          const next = new Map(prev)
          next.set(manualCourtScoreKey(gameNumber, log.courtId!), {
            gameNumber,
            courtId: log.courtId!,
            teamA,
            teamB,
          })
          return next
        })
      }
      const roundId = await resolveCompetitionRoundId(gameNumber)
      // #region agent log
      agentDebugIngest(
        'LB',
        `③ gesture synced ${teamA}-${teamB}${roundId ? '' : ' (no round)'}`,
        { courtSetupKey: log.courtSetupKey, roundId, courtId: log.courtId, teamA, teamB },
        'LB',
        '5d6061',
      )
      // #endregion
      if (roundId && log.courtId && log.finalScore) {
        applyMatchScore(roundId, log.courtId, `${teamA}-${teamB}`)
      }
      void refresh(true)
    },
    [applyGestureLog, applyMatchScore, refresh, resolveCompetitionRoundId, scoreUnit],
  )

  const handleActivePanel = useCallback(
    (panel: 'game' | 'leaderboard') => {
      if (panel === 'leaderboard' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      setTab(panel === 'game' ? 'games' : 'leaderboard')
    },
    [],
  )

  useEffect(() => {
    if (!isAdmin || !id || !session || started || loading) return
    if (session.status !== 'open') return
    if (autoStartAttemptedRef.current === id) return
    autoStartAttemptedRef.current = id
    void (async () => {
      const scheduleErr = await ensureCompetitionScheduleSaved(id, session, roster, sessionPairs)
      if (scheduleErr) return
      const { error: startErr } = await supabase.rpc('start_competition', { p_session_id: id })
      if (!startErr) void refresh(true)
    })()
  }, [isAdmin, id, session, roster, sessionPairs, started, loading, refresh])

  useEffect(() => {
    if (!isAdmin || !id || !session || !started || !isDuo || loading) return
    const storedVersion = Number(session.scoring_config?.schedule_version ?? 0)

    const hasRecordedResults =
      rounds.some((round) => round.status === 'complete') ||
      courtMatches.some((match) => Boolean(match.score_summary?.trim()))
    if (hasRecordedResults) return

    const migrationKey = `${id}:${storedVersion}`
    if (scheduleMigrationAttemptedRef.current === migrationKey) return
    scheduleMigrationAttemptedRef.current = migrationKey

    void (async () => {
      const scheduleErr = await ensureCompetitionScheduleSaved(id, session, roster, sessionPairs)
      if (scheduleErr) return
      const { error: rebuildErr } = await supabase.rpc('rebuild_competition_schedule', {
        p_session_id: id,
      })
      if (!rebuildErr) await refresh(true)
    })()
  }, [
    courtMatches,
    id,
    isAdmin,
    isDuo,
    loading,
    refresh,
    roster,
    rounds,
    session,
    sessionPairs,
    started,
  ])

  const standings = liveStandings
  const complete = isCompetitionComplete(session, rounds, courtMatches)
  const standingsOrder = useMemo(
    () => liveStandings.filter((row) => row.games > 0).map((row) => row.profile_id),
    [liveStandings],
  )
  const achievements = useMemo(() => {
    if (!started) return null
    const input = { roster, rounds, courtMatches, clubCourts }
    return complete
      ? calculateCompetitionAchievements(input, standingsOrder)
      : calculateLiveAchievements(input, standingsOrder)
  }, [started, complete, roster, rounds, courtMatches, clubCourts, standingsOrder])

  const leaderboardStandard =
    standings.length > 0 ? (
      <Leaderboard
        entries={standings}
        scoreUnit={scoreUnit}
        currentUserId={user?.id ?? null}
        competitionId={id ?? null}
        achievements={achievements}
        showAchievements={Boolean(achievements)}
        flushBottom
        shareTitle={session?.title ?? null}
      />
    ) : (
      <p className="game-card px-3 py-6 text-center text-sm text-brand-muted">
        {t('leaderboard.standings')}
      </p>
    )

  const leaderboardTv =
    standings.length > 0 ? (
      <Leaderboard
        entries={standings}
        scoreUnit={scoreUnit}
        currentUserId={user?.id ?? null}
        competitionId={id ?? null}
        achievements={achievements}
        showAchievements={false}
        compact
        embedded
        simpleTeamRows={isDuo}
      />
    ) : (
      <p className="px-3 py-6 text-center text-sm text-brand-muted">{t('leaderboard.standings')}</p>
    )

  const viewAlongUrl = id ? competitionViewAlongUrl(id) : null

  const gamesBody =
    columns.length > 0 ? (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <GameBoard
        competitionId={id}
        columns={columns}
        mode="scoring"
        activeGameNumber={activeRound?.round_number}
        scoreUnit={scoreUnit}
        playTo={playTo}
        liveCourtsByGame={liveCourtsByGame}
        roundIdForGame={roundIdForGame}
        courtIdByLabel={courtIdByLabel}
        canLog={canScore}
        matchForCourt={matchForCourt}
        onSubmitScores={handleSubmitScores}
        now={now}
        gameMinutes={schedule.gameMinutes}
        roundTimesByGame={roundTimesByGame}
        roundStatusByGame={roundStatusByGame}
        currentUserId={user?.id ?? null}
        currentUserAvatarUrl={headerAvatar}
        isAdmin={isAdmin}
        liveCourtScores={mergedLiveCourtScores}
        liveCourtFeeds={mergedLiveCourtFeeds}
        onGestureGamesSynced={handleGestureGamesSynced}
        onCompetitionCourtGamesSaved={handleCompetitionCourtGamesSaved}
        resolveCompetitionRoundId={resolveCompetitionRoundId}
        duoTeamLabels={isDuo ? duoTeamLabels : undefined}
        courtStandings={standings}
        roster={roster}
        rosterNameById={rosterNameById}
        tvCarousel={columns.length > 0}
        autoFollowActiveGame={isTvLayout}
        viewAlongUrl={isTvLayout ? viewAlongUrl : null}
        onTvGameChange={setTvGameNumber}
        onTvBack={() => navigate('/competitions')}
        leaderboardBody={!hasSideLeaderboard ? leaderboardStandard : undefined}
        activePanel={tab === 'games' ? 'game' : 'leaderboard'}
        onActivePanel={handleActivePanel}
        />
      </div>
    ) : started ? (
      <p className="game-card px-3 py-4 text-sm text-brand-muted">
        {t('competition.courtLayoutNotReady')}
      </p>
    ) : null

  const loadOrError = (
    <>
      {loading && !session ? (
        <p className="py-6 text-center text-xs text-brand-muted">{t('common.loading')}</p>
      ) : !session ? (
        <p className="py-6 text-center text-sm text-red-600">
          {error ?? t('competition.notFound')}
        </p>
      ) : null}
      {error && session ? <p className="text-center text-sm text-red-600">{error}</p> : null}
    </>
  )

  const sharedViewProps = {
    t,
    loadOrError,
    session,
    gamesBody,
  }

  return (
    <div className={`play-session-root flex min-h-0 flex-1 flex-col overflow-hidden${hasSideLeaderboard ? ' game-bg' : ''}`}>
      {hasSideLeaderboard ? (
        <div className="tv-play-view flex min-h-0 flex-1 flex-col overflow-hidden">
          <PlayTvView
            {...sharedViewProps}
            leaderboardBody={leaderboardTv}
            leaderboardLabel={t('leaderboard.standings')}
          />
        </div>
      ) : (
        <PlayStandardView {...sharedViewProps} />
      )}
    </div>
  )
}
