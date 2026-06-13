import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconEdit, IconJoin, IconOpenPad } from '../components/ButtonIcons'
import { AppShellColumn } from '../components/AppShellColumn'
import { AppShellPanel } from '../components/AppShellPanel'
import { AppTopBar } from '../components/AppTopBar'
import { PlayViewTabs, type PlayViewTab } from '../components/PlayViewTabs'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CompetitionLayoutPreview } from '../components/CompetitionLayoutPreview'
import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard'
import { FriendlyLateStartPanel } from '../components/FriendlyLateStartPanel'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { useFriendlyLiveCourtScores } from '../hooks/useFriendlyLiveCourtScores'
import { useFriendlyMatchLogs } from '../hooks/useFriendlyMatchLogs'
import { useMatchGestureLog } from '../hooks/useMatchGestureLog'
import { useTranslation } from '../hooks/useTranslation'
import { isReviewableLog } from '../lib/matchReviewHydrate'
import {
  canJoinFriendlyGame,
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlySessionRoster,
  friendlyStartsAtIso,
  isFreeFriendly,
  isOnFriendlyRoster,
} from '../lib/friendlyGames'
import {
  calculateFriendlySessionAchievements,
  computeFriendlySessionStandings,
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
import type { Profile } from '../lib/types'

export function FriendlyGamePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const isAdmin = Boolean(profile?.is_admin)
  const { game, loading, refresh } = useFriendlyGame(id)
  const { log } = useMatchGestureLog(id)
  const finished = isReviewableLog(log)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const { courtNames } = useSetupCourts()
  const [viewTab, setViewTab] = useState<PlayViewTab>('games')
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .order('display_name')
      .then(({ data }) => setProfiles((data as Profile[]) ?? []))
  }, [])

  const displayGame = useMemo(() => {
    if (!game) return null
    if (game.profileAvatars?.length) return game
    if (!game.profileIds) return game
    return {
      ...game,
      profileAvatars: game.profileIds.map((pid) =>
        pid ? (profiles.find((p) => p.id === pid)?.avatar_url ?? null) : null,
      ),
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

  const { scores: liveCourtScores, refresh: refreshLiveScores } = useFriendlyLiveCourtScores(
    id,
    scoreUnit,
  )
  const { logs: matchLogs, refresh: refreshMatchLogs } = useFriendlyMatchLogs(id)

  const sessionRoster = useMemo(
    () => (displayGame ? friendlySessionRoster(displayGame) : []),
    [displayGame],
  )

  const standings = useMemo(
    () => computeFriendlySessionStandings(matchLogs, scoreUnit, sessionRoster),
    [matchLogs, scoreUnit, sessionRoster],
  )

  const avatarSources = useMemo(
    () =>
      profiles
        .filter((p) => sessionRoster.some((player) => player.id === p.id))
        .map((p) => ({
          profile_id: p.id,
          member_profile_id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          total_points: 0,
          games: 0,
        })),
    [profiles, sessionRoster],
  )

  const enrichedStandings = useMemo(
    () => enrichStandingsWithAvatars(standings, avatarSources),
    [standings, avatarSources],
  )

  const achievements = useMemo(
    () => calculateFriendlySessionAchievements(matchLogs, scoreUnit, sessionRoster, enrichedStandings),
    [matchLogs, scoreUnit, sessionRoster, enrichedStandings],
  )

  const hasStandings = enrichedStandings.some((row) => row.games > 0)

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
  const showJoin = canJoinFriendlyGame(game, user?.id)
  const joined = isOnFriendlyRoster(game, user?.id)
  const isFree = isFreeFriendly(game)
  const canScore = Boolean(user && (isAdmin || joined || game.createdBy === user.id))
  const showPlayTabs = !isFree && previewGames.length > 0

  const actionCard = (
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
  )

  const gamesContent = (
    <>
      {isAdmin ? (
        <Link
          to={`/friendly/${game.id}/edit`}
          className="inline-flex items-center justify-center gap-1.5 text-xs text-brand-muted"
        >
          <IconEdit className="h-3.5 w-3.5" />
          {t('friendly.edit')}
        </Link>
      ) : null}

      {showPlayTabs ? (
        <CompetitionLayoutPreview
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
          onSubmitFriendlyScores={canScore ? handleSubmitFriendlyScores : undefined}
          onFriendlyScoresSaved={handleScoresSaved}
        />
      ) : null}

      {isAdmin && !isFree && game.status === 'ready' ? (
        <FriendlyLateStartPanel game={game} config={organizedConfig} onUpdated={refresh} />
      ) : null}

      {actionCard}
    </>
  )

  const leaderboardContent = hasStandings ? (
    <CompetitionLeaderboard
      entries={enrichedStandings}
      scoreUnit={scoreUnit}
      currentUserId={user?.id ?? null}
      competitionId={null}
      achievements={achievements}
      flushBottom
    />
  ) : (
    <div className="game-card space-y-1 px-3 py-4 text-center">
      <p className="text-sm text-brand-muted">{t('friendly.noLeaderboardScores')}</p>
      <p className="text-xs text-brand-muted">{t('friendly.noLeaderboardHint')}</p>
    </div>
  )

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
      <AppTopBar className="shrink-0 border-b border-brand-border/40 bg-brand-bg">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/friendly')}
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
              <PlayViewTabs tab={viewTab} onTab={setViewTab} t={t} />
            </nav>
          }
        >
          <div className="app-shell-panel-inset space-y-3">
            {viewTab === 'games' ? gamesContent : leaderboardContent}
          </div>
        </AppShellPanel>
      </AppShellColumn>
    </div>
  )
}
