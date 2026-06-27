import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconJoin, IconOpenPad } from '../components/ButtonIcons'
import { CompetitionPlayStandardView } from '../components/competitionPlay/CompetitionPlayStandardView'
import { CompetitionPlayTvView } from '../components/competitionPlay/CompetitionPlayTvView'
import type { PlayViewTab } from '../components/PlayViewTabs'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { GameBoardPreview } from '../components/GameBoardPreview'
import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { LeaderboardViewAlongQrPanel } from '../components/LeaderboardViewAlongQrPanel'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { useFriendlyLiveCourtScores } from '../hooks/useFriendlyLiveCourtScores'
import { useFriendlyMatchLogs } from '../hooks/useFriendlyMatchLogs'
import { useMatchGestureLog } from '../hooks/useMatchGestureLog'
import { useTranslation } from '../hooks/useTranslation'
import { useIsTvLayout } from '../hooks/useIsTvLayout'
import { isReviewableLog } from '../lib/matchReviewHydrate'
import {
  canJoinFriendlyGame,
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyScheduleLive,
  friendlySessionRoster,
  friendlyStartsAtIso,
  isFreeFriendly,
  isFriendlySessionStarted,
  isOnFriendlyRoster,
} from '../lib/friendlyGames'
import {
  calculateFriendlySessionAchievements,
  computeFriendlySessionStandings,
  filterFriendlyMatchLogsForSchedule,
} from '../lib/friendlySessionStandings'
import { enrichStandingsWithAvatars } from '../lib/leaderboardEntries'
import { joinFriendlySession } from '../lib/friendlyServer'
import {
  saveFriendlyManualCourtScore,
  type FriendlyCourtScoreSubmit,
} from '../lib/friendlyManualScore'
import { americanoScoringUnit } from '../lib/competitionPresets'
import { useSetupCourts } from '../hooks/useSetupCourts'
import { formatDateInput } from '../lib/courtSchedule'
import { supabase } from '../lib/supabaseClient'
import { friendlyViewAlongUrl } from '../lib/siteUrl'
import type { Profile } from '../lib/types'

export function FriendlyGamePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const playerDisplayName = profile?.display_name ?? lineClient.displayName ?? null
  const isAdmin = Boolean(profile?.is_admin)
  const isTvLayout = useIsTvLayout()
  const { game, loading, refresh } = useFriendlyGame(id)
  const { log } = useMatchGestureLog(id)
  const finished = isReviewableLog(log)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const { courtNames } = useSetupCourts()
  const [viewTab, setViewTab] = useState<PlayViewTab>(() =>
    searchParams.get('view') === 'leaderboard' ? 'leaderboard' : 'games',
  )
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const rosterIds = (game?.profileIds ?? []).filter((id): id is string => Boolean(id))
    if (!rosterIds.length) {
      setProfiles([])
      return
    }
    void supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', rosterIds)
      .then(({ data }) => setProfiles((data as Profile[]) ?? []))
  }, [game?.profileIds])

  const displayGame = useMemo(() => {
    if (!game) return null
    const ids = game.profileIds ?? []
    const storedAvatars = game.profileAvatars ?? []
    return {
      ...game,
      profileAvatars: ids.map((pid, i) => {
        if (storedAvatars[i]) return storedAvatars[i]
        if (pid) return profiles.find((p) => p.id === pid)?.avatar_url ?? null
        return null
      }),
    }
  }, [game, profiles])

  const organizedConfig = useMemo(() => {
    const base = game?.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
    return {
      ...DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
      ...base,
      day: base.day || formatDateInput(new Date()),
    }
  }, [game?.organizedConfig])

  const previewGames = useMemo(
    () => (displayGame ? friendlyPreviewGames(displayGame, courtNames, displayGame.profileAvatars) : []),
    [displayGame, courtNames],
  )

  const previewSession = useMemo(
    () => friendlyOrganizedSession(organizedConfig),
    [organizedConfig],
  )

  const scoreUnit = useMemo(() => americanoScoringUnit(previewSession), [previewSession])

  const { scores: liveCourtScores, feeds: liveCourtFeeds, refresh: refreshLiveScores } = useFriendlyLiveCourtScores(
    id,
    scoreUnit,
  )
  const { logs: matchLogs, refresh: refreshMatchLogs } = useFriendlyMatchLogs(id)

  const sessionRoster = useMemo(
    () => (displayGame ? friendlySessionRoster(displayGame) : []),
    [displayGame],
  )

  const scheduleLive = useMemo(
    () => isFreeFriendly(game) || friendlyScheduleLive(organizedConfig, now),
    [game, organizedConfig, now],
  )

  const scoringLogs = useMemo(
    () =>
      isFreeFriendly(game)
        ? matchLogs
        : filterFriendlyMatchLogsForSchedule(matchLogs, organizedConfig, now),
    [game, matchLogs, organizedConfig, now],
  )

  const standings = useMemo(
    () => computeFriendlySessionStandings(scoringLogs, scoreUnit, sessionRoster),
    [scoringLogs, scoreUnit, sessionRoster],
  )

  const avatarSources = useMemo(() => {
    if (!displayGame) return []
    const ids = displayGame.profileIds ?? []
    const avatars = displayGame.profileAvatars ?? []
    return ids.flatMap((pid, i) => {
      if (!pid) return []
      const profile = profiles.find((p) => p.id === pid)
      return [
        {
          profile_id: pid,
          member_profile_id: pid,
          display_name: profile?.display_name ?? displayGame.players[i] ?? '',
          avatar_url: avatars[i] ?? profile?.avatar_url ?? null,
          total_points: 0,
          games: 0,
        },
      ]
    })
  }, [displayGame, profiles])

  const enrichedStandings = useMemo(() => {
    const rosterAvatars = new Map(
      sessionRoster.flatMap((player) => {
        if (!player.avatarUrl) return []
        const key = player.id ?? player.name
        return [[key, player.avatarUrl] as const]
      }),
    )
    return enrichStandingsWithAvatars(standings, avatarSources).map((entry) => ({
      ...entry,
      avatar_url:
        entry.avatar_url ??
        (entry.member_profile_id ? rosterAvatars.get(entry.member_profile_id) : undefined) ??
        rosterAvatars.get(entry.profile_id) ??
        null,
    }))
  }, [standings, avatarSources, sessionRoster])

  const scoredCourts = useMemo(
    () =>
      new Set(matchLogs.filter((log) => log.matchEndedAt).map((log) => log.courtSetupKey)).size,
    [matchLogs],
  )
  const sessionStarted = useMemo(
    () => (game ? isFriendlySessionStarted(game, scoredCourts, now) : false),
    [game, scoredCourts, now],
  )

  const achievements = useMemo(
    () =>
      sessionStarted
        ? calculateFriendlySessionAchievements(
            scoringLogs,
            scoreUnit,
            sessionRoster,
            enrichedStandings,
          )
        : null,
    [sessionStarted, scoringLogs, scoreUnit, sessionRoster, enrichedStandings],
  )

  const handleSubmitFriendlyScores = useCallback(
    async (entries: FriendlyCourtScoreSubmit[]) => {
      if (!game) return
      for (const entry of entries) {
        const { error } = await saveFriendlyManualCourtScore(game.id, entry, scoreUnit)
        if (error) throw new Error(error)
      }
    },
    [game, scoreUnit],
  )

  const handleScoresSaved = useCallback(async () => {
    await Promise.all([refreshLiveScores(), refreshMatchLogs(), refresh()])
  }, [refresh, refreshLiveScores, refreshMatchLogs])

  const join = async () => {
    if (!game || !user) return
    setJoinBusy(true)
    setJoinError(null)
    const err = await joinFriendlySession(game.id)
    setJoinBusy(false)
    if (err) {
      setJoinError(err)
      return
    }
    await refresh()
  }

  if (loading) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-brand-bg">
        <p className="py-6 text-center text-sm text-brand-muted">{t('common.loading')}</p>
      </div>
    )
  }
  if (!id || !game || !displayGame) return <Navigate to="/friendly" replace />

  const gameMinutes = organizedConfig.gameMinutes
  const startsAtIso = friendlyStartsAtIso(organizedConfig)
  const showJoin = canJoinFriendlyGame(game, user?.id, profile?.display_name)
  const joined = isOnFriendlyRoster(game, user?.id)
  const isFree = isFreeFriendly(game)
  const scoreSubmitEnabled = scheduleLive
  const showPlayTabs = !isFree && previewGames.length > 0
  const hasActionCard = Boolean(
    showJoin ||
      (joined && !isAdmin) ||
      (isAdmin && isFree) ||
      (isAdmin && finished) ||
      joinError,
  )

  const actionCard = hasActionCard ? (
    <div className="game-card space-y-2 p-3">
      {showJoin ? (
        <button
          type="button"
          disabled={joinBusy}
          onClick={() => void join()}
          className="brand-btn w-full py-3 text-sm font-semibold disabled:opacity-50"
        >
          <IconJoin />
          {joinBusy ? t('common.loading') : t('friendly.join')}
        </button>
      ) : null}

      {joined && !isAdmin ? (
        <p className="text-center text-xs text-brand-muted">{t('friendly.onRoster')}</p>
      ) : null}

      {isAdmin && isFree ? (
        <Link
          to={`/friendly/${game.id}/pad`}
          className="brand-btn w-full py-3 text-sm font-semibold"
        >
          <IconOpenPad />
          {t('friendly.openPad')}
        </Link>
      ) : null}

      {isAdmin && finished ? (
        <Link
          to={`/friendly/${game.id}/heatmap`}
          className="block w-full rounded-xl border border-brand-border bg-brand-surface py-3 text-center text-sm font-semibold text-brand-primary transition active:opacity-80"
        >
          {t('stats.title')}
        </Link>
      ) : null}

      {joinError ? <p className="text-xs text-red-600">{joinError}</p> : null}
    </div>
  ) : null

  const viewAlongUrl = game?.id ? friendlyViewAlongUrl(game.id) : null

  const gamesBody = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <GameBoardPreview
          session={previewSession}
          games={previewGames}
          eventStartsAt={startsAtIso}
          gameMinutes={gameMinutes}
          friendlySessionId={game.id}
          friendly
          isAdmin={isAdmin}
          currentUserId={user?.id}
          currentUserAvatarUrl={headerAvatar}
          liveCourtScores={liveCourtScores}
          liveCourtFeeds={liveCourtFeeds}
          onSubmitFriendlyScores={user ? handleSubmitFriendlyScores : undefined}
          scoreSubmitEnabled={scoreSubmitEnabled}
          onFriendlyScoresSaved={handleScoresSaved}
          gameCarousel
          viewAlongUrl={isTvLayout ? viewAlongUrl : null}
          currentUserDisplayName={playerDisplayName}
          onBack={() => navigate('/friendly')}
        />
      </div>
      {!isTvLayout && actionCard ? <div className="shrink-0 px-2 pb-2">{actionCard}</div> : null}
    </div>
  )

  const leaderboardStandard =
    enrichedStandings.length > 0 ? (
      <CompetitionLeaderboard
        entries={enrichedStandings}
        scoreUnit={scoreUnit}
        currentUserId={user?.id ?? null}
        competitionId={null}
        achievements={achievements}
        showAchievements={Boolean(achievements)}
        flushBottom
      />
    ) : (
      <div className="game-card space-y-1 px-3 py-4 text-center">
        <p className="text-sm text-brand-muted">{t('friendly.noLeaderboardScores')}</p>
        <p className="text-xs text-brand-muted">{t('friendly.noLeaderboardHint')}</p>
      </div>
    )

  const leaderboardTv =
    enrichedStandings.length > 0 ? (
      <CompetitionLeaderboard
        entries={enrichedStandings}
        scoreUnit={scoreUnit}
        currentUserId={user?.id ?? null}
        competitionId={null}
        achievements={achievements}
        showAchievements={false}
        compact
        embedded
      />
    ) : (
      <div className="space-y-1 px-3 py-4 text-center">
        <p className="text-sm text-brand-muted">{t('friendly.noLeaderboardScores')}</p>
        <p className="text-xs text-brand-muted">{t('friendly.noLeaderboardHint')}</p>
      </div>
    )

  const gamesContent = showPlayTabs ? gamesBody : actionCard

  if (!showPlayTabs) {
    return (
      <div className="space-y-3 pb-6">
        <Link to="/friendly" className="text-sm font-medium text-brand-accent">
          {t('common.back')}
        </Link>
        {gamesContent}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-brand-bg">
      {isTvLayout ? (
        <div className="tv-play-view flex min-h-0 flex-1 flex-col overflow-hidden">
          <CompetitionPlayTvView
            t={t}
            loadOrError={null}
            session={displayGame}
            gamesBody={gamesBody}
            leaderboardBody={leaderboardTv}
          />
        </div>
      ) : (
        <>
          <CompetitionPlayStandardView
            t={t}
            tab={viewTab}
            onTab={setViewTab}
            scrollBody={false}
            loadOrError={null}
            session={displayGame}
            gamesBody={gamesBody}
            leaderboardBody={leaderboardStandard}
          />
          {viewTab === 'leaderboard' && viewAlongUrl && enrichedStandings.length > 0 ? (
            <LeaderboardViewAlongQrPanel url={viewAlongUrl} />
          ) : null}
        </>
      )}
    </div>
  )
}
