import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ensureCompetitionScheduleSaved } from '../lib/persistCompetitionSchedule'
import { GameBoard } from '../components/GameBoard'
import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { CompetitionPlayStandardView } from '../components/competitionPlay/CompetitionPlayStandardView'
import { CompetitionPlayTvView } from '../components/competitionPlay/CompetitionPlayTvView'
import type { PlayViewTab } from '../components/PlayViewTabs'
import { useAuth } from '../hooks/useAuth'
import { useIsTvLayout } from '../hooks/useIsTvLayout'
import { useCompetitionBoard } from '../hooks/useCompetitionBoard'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { usePublicCompetition } from '../hooks/usePublicCompetition'
import {
  calculateCompetitionAchievements,
  calculateLiveAchievements,
  isCompetitionComplete,
} from '../lib/competitionAchievements'
import { americanoScheduleFromSession, gameSlotTimes } from '../lib/competitionLayout'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import { computeAmericanoStandings } from '../lib/competitionStandings'
import { computeDuoStandings } from '../lib/computeDuoStandings'
import { duoLabelsForMatch } from '../lib/competitionFormatPresets'
import { rosterDisplayName } from '../hooks/useCompetitions'
import { AppTopBar } from '../components/AppTopBar'
import { useTranslation } from '../hooks/useTranslation'
import { enrichStandingsWithAvatars } from '../lib/leaderboardEntries'
import { competitionViewAlongUrl } from '../lib/siteUrl'
import { supabase } from '../lib/supabaseClient'

type PlayTab = PlayViewTab

export function CompetitionPlay() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const isAdmin = Boolean(user && profile?.is_admin)
  const isTvLayout = useIsTvLayout()
  const [tab, setTab] = useState<PlayTab>(() =>
    searchParams.get('view') === 'leaderboard' ? 'leaderboard' : 'games',
  )

  const {
    session,
    rounds,
    activeRound,
    courtMatches,
    roster,
    clubCourts,
    leaderboard,
    loading,
    error,
    refresh,
    applyMatchScore,
  } = usePublicCompetition(id, {
    pollMs: 20_000,
  })
  const { columns, liveCourtsByGame, roundIdForGame, courtIdByLabel, scoreUnit, playTo, matchForCourt, isDuo, teams } =
    useCompetitionBoard(session, rounds, roster, clubCourts, courtMatches)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (tab === 'leaderboard') void refresh(true)
  }, [tab, refresh])

  const schedule = useMemo(() => americanoScheduleFromSession(session), [session])

  const rosterNameById = useMemo(
    () => new Map(roster.map((row) => [row.id, rosterDisplayName(row)])),
    [roster],
  )

  const duoTeamLabels = useCallback(
    (teamA: [string, string], teamB: [string, string]) =>
      duoLabelsForMatch(teams, rosterNameById, teamA, teamB),
    [teams, rosterNameById],
  )

  const playerStandings = useMemo(
    () =>
      enrichStandingsWithAvatars(
        computeAmericanoStandings(roster, rounds, courtMatches),
        leaderboard,
      ),
    [roster, rounds, courtMatches, leaderboard],
  )

  const liveStandings = useMemo(() => {
    if (isDuo && teams.length >= 2) {
      return enrichStandingsWithAvatars(
        computeDuoStandings(roster, rounds, courtMatches, teams),
        leaderboard,
      )
    }
    return playerStandings
  }, [isDuo, teams, roster, rounds, courtMatches, leaderboard, playerStandings])

  const roundTimesByGame = useMemo(() => {
    const map = new Map<number, { startsAt: number; endsAt: number }>()
    if (session?.starts_at) {
      const games = Math.max(rounds.length, schedule.totalGames)
      for (let g = 1; g <= games; g++) {
        const slot = gameSlotTimes(
          session.starts_at,
          g,
          schedule.gameMinutes,
          schedule.breakMinutes,
        )
        map.set(g, { startsAt: slot.startsAt.getTime(), endsAt: slot.endsAt.getTime() })
      }
      return map
    }
    for (const round of rounds) {
      map.set(round.round_number, {
        startsAt: new Date(round.starts_at).getTime(),
        endsAt: new Date(round.ends_at).getTime(),
      })
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
      await refresh(true)
    },
    [applyMatchScore, refresh],
  )

  const started = Boolean(session?.competition_started_at)
  const autoStartAttemptedRef = useRef(false)

  useEffect(() => {
    if (!isAdmin || !id || !session || started || loading || autoStartAttemptedRef.current) return
    if (session.status !== 'open') return
    autoStartAttemptedRef.current = true
    void (async () => {
      await ensureCompetitionScheduleSaved(id, session, roster)
      const { error: startErr } = await supabase.rpc('start_competition', { p_session_id: id })
      if (!startErr) void refresh(true)
    })()
  }, [isAdmin, id, session, roster, started, loading, refresh])

  const canScore = started
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
      <CompetitionLeaderboard
        entries={standings}
        duoPlayerEntries={isDuo ? playerStandings : undefined}
        scoreUnit={scoreUnit}
        currentUserId={user?.id ?? null}
        competitionId={id ?? null}
        achievements={achievements}
        showAchievements={Boolean(achievements)}
        flushBottom
      />
    ) : (
      <p className="game-card px-3 py-6 text-center text-sm text-brand-muted">
        {t('leaderboard.standings')}
      </p>
    )

  const leaderboardTv =
    standings.length > 0 ? (
      <CompetitionLeaderboard
        entries={standings}
        duoPlayerEntries={isDuo ? playerStandings : undefined}
        scoreUnit={scoreUnit}
        currentUserId={user?.id ?? null}
        competitionId={id ?? null}
        achievements={achievements}
        showAchievements={Boolean(achievements)}
        compact
        embedded
      />
    ) : (
      <p className="px-3 py-6 text-center text-sm text-brand-muted">{t('leaderboard.standings')}</p>
    )

  const viewAlongUrl = id ? competitionViewAlongUrl(id) : null

  const gamesBody =
    columns.length > 0 ? (
      <GameBoard
        competitionId={id}
        columns={columns}
        mode={started ? 'scoring' : 'preview'}
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
        duoTeamLabels={isDuo ? duoTeamLabels : undefined}
        tvCarousel={columns.length > 0}
        viewAlongUrl={isTvLayout ? viewAlongUrl : null}
      />
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
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-brand-bg">
      <AppTopBar className="shrink-0 border-b border-brand-border/40 bg-brand-bg">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/competitions')}
            aria-label={t('aria.back')}
            className="shrink-0 text-xl font-medium leading-none text-brand-accent"
          >
            ←
          </button>
          <img
            src="/brand/logo-padel.webp"
            alt={t('common.brandAlt')}
            className="h-8 w-auto max-w-[7rem] shrink-0 md:h-10 md:max-w-[9rem]"
          />
        </div>
      </AppTopBar>

      {isTvLayout ? (
        <div className="tv-play-view flex min-h-0 flex-1 flex-col overflow-hidden">
          <CompetitionPlayTvView
            {...sharedViewProps}
            leaderboardBody={leaderboardTv}
          />
        </div>
      ) : (
        <CompetitionPlayStandardView
          {...sharedViewProps}
          tab={tab}
          onTab={setTab}
          leaderboardBody={leaderboardStandard}
        />
      )}
    </div>
  )
}
