import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CompetitionCourtBoard } from '../components/CompetitionCourtBoard'
import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { useAuth } from '../hooks/useAuth'
import { useCompetitionBoard } from '../hooks/useCompetitionBoard'
import { useGuestPlayerClaim } from '../hooks/useGuestPlayerClaim'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { usePublicCompetition } from '../hooks/usePublicCompetition'
import { saveReturnTo } from '../lib/authReturnTo'
import { americanoScheduleFromSession, gameSlotTimes } from '../lib/competitionLayout'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import { computeAmericanoStandings } from '../lib/competitionStandings'
import { supabase } from '../lib/supabaseClient'

type PlayTab = 'games' | 'leaderboard'

function PlayTabs({ tab, onTab }: { tab: PlayTab; onTab: (t: PlayTab) => void }) {
  return (
    <div className="game-dock-inner">
      <button
        type="button"
        onClick={() => onTab('games')}
        className={`game-tab game-tab-competition ${tab === 'games' ? 'game-tab-selected' : ''}`}
      >
        <span className="font-display text-sm leading-tight">Games</span>
      </button>
      <button
        type="button"
        onClick={() => onTab('leaderboard')}
        className={`game-tab game-tab-rank ${tab === 'leaderboard' ? 'game-tab-selected' : ''}`}
      >
        <span className="font-display text-sm leading-tight">Leaderboard</span>
      </button>
    </div>
  )
}

export function CompetitionPlay() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const lineClient = useLineClientProfile()
  const headerName =
    profile?.display_name ??
    lineClient.displayName ??
    (lineClient.lineLoggedIn ? 'LINE connected' : user ? 'Profile' : 'Sign in')
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null

  const openProfile = () => {
    if (!user) {
      saveReturnTo('/profile')
      navigate('/login', { replace: true, state: { from: '/profile' } })
      return
    }
    navigate('/profile')
  }

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
  } = usePublicCompetition(id)
  const { columns, liveCourtsByGame, roundIdForGame, courtIdByLabel, scoreUnit, playTo, matchForCourt } =
    useCompetitionBoard(session, rounds, roster, clubCourts, courtMatches)
  const [tab, setTab] = useState<PlayTab>('games')
  const [now, setNow] = useState(Date.now())
  const [claimError, setClaimError] = useState<string | null>(null)
  const { userId, claimNow } = useGuestPlayerClaim({
    competitionId: id ?? null,
    onClaimed: () => {
      setClaimError(null)
      void refresh(true)
    },
  })

  const handleGuestClaim = async (padelPlayerId: string) => {
    try {
      setClaimError(null)
      await claimNow(padelPlayerId)
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : 'Could not link scores')
    }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const schedule = useMemo(() => americanoScheduleFromSession(session), [session])

  const liveStandings = useMemo(
    () => computeAmericanoStandings(roster, rounds, courtMatches),
    [roster, rounds, courtMatches],
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
  const canScore = started && !finished
  const showGamesBoard = started && (columns.length > 0 || (finished && rounds.length > 0))
  const standings = finished ? leaderboard : liveStandings

  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-brand-primary">
          {session?.title ?? 'Competition'}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/competitions')}
            className="shrink-0 text-sm font-medium text-brand-accent"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={openProfile}
            className="flex max-w-[8.5rem] items-center gap-1.5 truncate rounded-full border border-brand-border bg-brand-surface py-1.5 pl-1.5 pr-2.5 text-xs font-medium text-brand-primary"
          >
            {headerAvatar ? (
              <img
                src={headerAvatar}
                alt=""
                className="h-6 w-6 shrink-0 rounded-full object-cover"
              />
            ) : null}
            <span className="truncate">{headerName}</span>
          </button>
        </div>
      </header>

      <main data-scroll-y className="scroll-y min-h-0 min-w-0 flex-1 px-3 pb-2">
        <div className="mx-auto w-full max-w-full space-y-3">
          {loading && !session ? (
            <p className="py-6 text-center text-xs text-brand-muted">Loading…</p>
          ) : !session ? (
            <p className="py-6 text-center text-sm text-red-600">{error ?? 'Competition not found'}</p>
          ) : null}
          {session && !started ? (
            <p className="py-6 text-center text-sm text-brand-muted">
              Waiting for the organiser to publish.
            </p>
          ) : finished ? (
            <p className="game-card px-3 py-2 text-center text-sm text-brand-muted">
              Competition complete — scores are read-only.
            </p>
          ) : null}
          {started && tab === 'games' ? (
            showGamesBoard ? (
              <CompetitionCourtBoard
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
                onSaved={() => void refresh(true)}
                now={now}
                gameMinutes={schedule.gameMinutes}
                roundTimesByGame={roundTimesByGame}
                roundStatusByGame={roundStatusByGame}
              />
            ) : (
              <p className="game-card px-3 py-4 text-sm text-brand-muted">Court layout not ready yet.</p>
            )
          ) : started ? (
            <CompetitionLeaderboard
              entries={standings}
              scoreUnit={scoreUnit}
              currentUserId={userId}
              competitionId={id ?? null}
              onGuestClaim={(id) => void handleGuestClaim(id)}
            />
          ) : null}

          {claimError && <p className="text-center text-sm text-red-600">{claimError}</p>}
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
        </div>
      </main>

      <nav className="game-dock w-full min-w-0 shrink-0" aria-label="Competition views">
        <PlayTabs tab={tab} onTab={setTab} />
      </nav>
    </div>
  )
}
