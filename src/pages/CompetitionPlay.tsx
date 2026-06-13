import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CompetitionCourtBoard } from '../components/CompetitionCourtBoard'
import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { useAuth } from '../hooks/useAuth'
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
import { AppTopBar } from '../components/AppTopBar'
import { AppShellColumn } from '../components/AppShellColumn'
import { AppShellPanel } from '../components/AppShellPanel'
import { PlayViewTabs, type PlayViewTab } from '../components/PlayViewTabs'
import { useTranslation } from '../hooks/useTranslation'
import { enrichStandingsWithAvatars } from '../lib/leaderboardEntries'
import { supabase } from '../lib/supabaseClient'

type PlayTab = PlayViewTab

export function CompetitionPlay() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const isAdmin = Boolean(user && profile?.is_admin)
  const [tab, setTab] = useState<PlayTab>('games')

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
    pollMs: tab === 'leaderboard' ? 20_000 : false,
  })
  const { columns, liveCourtsByGame, roundIdForGame, courtIdByLabel, scoreUnit, playTo, matchForCourt } =
    useCompetitionBoard(session, rounds, roster, clubCourts, courtMatches)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (tab === 'leaderboard') void refresh(true)
  }, [tab, refresh])

  const schedule = useMemo(() => americanoScheduleFromSession(session), [session])

  const liveStandings = useMemo(
    () =>
      enrichStandingsWithAvatars(
        computeAmericanoStandings(roster, rounds, courtMatches),
        leaderboard,
      ),
    [roster, rounds, courtMatches, leaderboard],
  )

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
      for (let g = 1; g <= games; g++) {
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

  useEffect(() => {
    if (isAdmin && session && !started && id) {
      navigate(`/competitions/${id}/run`, { replace: true })
    }
  }, [isAdmin, session, started, id, navigate])
  const canScore = started && !finished
  const showGamesBoard = started && (columns.length > 0 || (finished && rounds.length > 0))
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

      <AppShellColumn className="overflow-hidden pt-1">
        <AppShellPanel
          footer={
            <nav className="app-shell-panel-footer gap-0" aria-label={t('aria.competitionViews')}>
              <PlayViewTabs tab={tab} onTab={setTab} t={t} />
            </nav>
          }
        >
          <div className="app-shell-panel-inset space-y-3">
          {loading && !session ? (
            <p className="py-6 text-center text-xs text-brand-muted">{t('common.loading')}</p>
          ) : !session ? (
            <p className="py-6 text-center text-sm text-red-600">
              {error ?? t('competition.notFound')}
            </p>
          ) : null}
          {session && !started && tab === 'games' ? (
            <p className="py-6 text-center text-sm text-brand-muted">
              {t('competition.waitingOrganiser')}
            </p>
          ) : null}
          {started && tab === 'games' ? (
            showGamesBoard ? (
              <CompetitionCourtBoard
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
              />
            ) : (
              <p className="game-card px-3 py-4 text-sm text-brand-muted">
                {t('competition.courtLayoutNotReady')}
              </p>
            )
          ) : session && tab === 'leaderboard' ? (
            <CompetitionLeaderboard
              entries={standings}
              scoreUnit={scoreUnit}
              currentUserId={user?.id ?? null}
              competitionId={id ?? null}
              achievements={achievements}
              showAchievements={Boolean(achievements)}
              flushBottom
            />
          ) : null}

          {error && <p className="text-center text-sm text-red-600">{error}</p>}
          </div>
        </AppShellPanel>
      </AppShellColumn>
    </div>
  )
}
