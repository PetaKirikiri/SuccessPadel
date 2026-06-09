import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CompetitionLayoutPreview } from '../components/CompetitionLayoutPreview'
import { FriendlyGameCard } from '../components/FriendlyGameCard'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { useTranslation } from '../hooks/useTranslation'
import {
  canJoinFriendlyGame,
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyStartsAtIso,
  isFreeFriendly,
  isOnFriendlyRoster,
} from '../lib/friendlyGames'
import { joinFriendlySession } from '../lib/friendlyServer'
import { formatDateInput } from '../lib/courtSchedule'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'

export function FriendlyGamePage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const lineClient = useLineClientProfile()
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const isAdmin = Boolean(profile?.is_admin)
  const { game, loading, refresh } = useFriendlyGame(id)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [courtNames, setCourtNames] = useState<string[]>([])
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .order('display_name')
      .then(({ data }) => setProfiles((data as Profile[]) ?? []))
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.rpc('list_setup_courts')
      if (active && Array.isArray(data)) {
        setCourtNames(
          (data as { name: string; sort_order: number }[])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => c.name),
        )
      }
    })()
    return () => {
      active = false
    }
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

  if (loading) return <p className="text-sm text-brand-muted">{t('common.loading')}</p>
  if (!id || !game || !displayGame) return <Navigate to="/friendly" replace />

  const gameMinutes = organizedConfig.gameMinutes
  const startsAtIso = friendlyStartsAtIso(organizedConfig)
  const showJoin = canJoinFriendlyGame(game, user?.id)
  const joined = isOnFriendlyRoster(game, user?.id)
  const isFree = isFreeFriendly(game)

  return (
    <div className="space-y-3 pb-6">
      <Link to="/friendly" className="text-sm font-medium text-brand-accent">
        ← {t('common.back')}
      </Link>

      <FriendlyGameCard
        game={displayGame}
        currentUserId={user?.id}
        currentUserAvatarUrl={headerAvatar}
        isAdmin={isAdmin}
        courtNames={courtNames}
        showCourts
      />

      {!isFree && previewGames.length > 0 && !isAdmin ? (
        <div className="game-card overflow-hidden p-0">
          <div className="overflow-hidden rounded-lg">
            <CompetitionLayoutPreview
              session={previewSession}
              games={previewGames}
              eventStartsAt={startsAtIso}
              gameMinutes={gameMinutes}
            />
          </div>
        </div>
      ) : null}

      <div className="game-card space-y-2 p-3">
        {showJoin ? (
          <button
            type="button"
            disabled={joinBusy}
            onClick={() => void join()}
            className="brand-btn w-full py-3 text-sm font-semibold disabled:opacity-50"
          >
            {joinBusy ? t('common.loading') : t('friendly.join')}
          </button>
        ) : null}

        {joined && !isAdmin ? (
          <p className="text-center text-xs text-brand-muted">{t('friendly.onRoster')}</p>
        ) : null}

        {isAdmin && isFree ? (
          <Link
            to={`/friendly/${game.id}/pad`}
            className="brand-btn block w-full py-3 text-center text-sm font-semibold"
          >
            {t('friendly.openPad')}
          </Link>
        ) : null}

        {joinError ? <p className="text-xs text-red-600">{joinError}</p> : null}
      </div>
    </div>
  )
}
