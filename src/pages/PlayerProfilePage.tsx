import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppTopBar } from '../components/AppTopBar'
import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
import { LineAppBookmark } from '../components/LineAppBookmark'
import { LinePlayerLinkModal } from '../components/LinePlayerLinkModal'
import { PlayerMatchHistory } from '../components/PlayerMatchHistory'
import { PlayerProfileBanner } from '../components/PlayerProfileBanner'
import { PlayerProfileCard } from '../components/PlayerProfileCard'
import type { PlayerProfileTab } from '../components/PlayerProfileTabs'
import { PlayerProfileView } from '../components/PlayerProfileView'
import { ProfileDetailsForm, type EditableProfile } from '../components/ProfileDetailsForm'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useTranslation } from '../hooks/useTranslation'
import { useLocale } from '../providers/LocaleProvider'
import { isClaimableGuest } from '../lib/leaderboardEntries'
import type { Achievement } from '../lib/competitionAchievements'
import { resolvePlayerProfile } from '../lib/playerProfile'

export type PlayerProfileSnapshot = {
  entry: LeaderboardEntry
  rank: number
  unit: string
  badges: Achievement[]
}

type LocationState = {
  from?: string
  snapshot?: PlayerProfileSnapshot
}

function snapshotEntryMatchesRoute(
  entry: LeaderboardEntry | null | undefined,
  playerId: string | undefined,
): boolean {
  if (!entry || !playerId) return false
  return (
    entry.profile_id === playerId ||
    entry.member_profile_id === playerId ||
    entry.padel_player_id === playerId
  )
}

function toEditableProfile(
  source: EditableProfile | null | undefined,
): EditableProfile | null {
  if (!source) return null
  return {
    id: source.id,
    display_name: source.display_name,
    avatar_url: source.avatar_url,
    playtomic_number: source.playtomic_number,
    racket: source.racket,
    play_style: source.play_style,
    preferred_side: source.preferred_side,
    enjoys_fun_games: source.enjoys_fun_games,
    usually_free: source.usually_free,
    gender: source.gender,
    dominant_hand: source.dominant_hand,
    skill_level: source.skill_level,
  }
}

export function PlayerProfilePage() {
  const { playerId } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { user, profile: authProfile, loading: authLoading, refreshProfile, signOut } = useAuth()
  const { inClient } = useLineClientProfile()
  const competitionId = searchParams.get('competition')
  const state = location.state as LocationState | null
  const snapshot = state?.snapshot ?? null
  const routeEntry = snapshotEntryMatchesRoute(snapshot?.entry, playerId)
    ? (snapshot?.entry ?? null)
    : null
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [resolved, setResolved] = useState<Awaited<ReturnType<typeof resolvePlayerProfile>> | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [linkTarget, setLinkTarget] = useState<{ id: string; name: string } | null>(null)
  const [tab, setTab] = useState<PlayerProfileTab>('profile')

  const isOwnProfile = Boolean(
    user?.id && (user.id === playerId || user.id === resolved?.profile?.id),
  )

  const isAdmin = Boolean(authProfile?.is_admin)

  const profileId = useMemo(
    () =>
      resolved?.profile?.id ??
      routeEntry?.member_profile_id ??
      (routeEntry?.is_guest ? null : routeEntry?.profile_id) ??
      playerId ??
      null,
    [playerId, resolved?.profile?.id, routeEntry],
  )

  const editableProfile = useMemo(() => {
    if (isOwnProfile && authProfile) return toEditableProfile(authProfile)
    if (isAdmin && resolved?.profile) return toEditableProfile(resolved.profile)
    if (isOwnProfile && resolved?.profile) return toEditableProfile(resolved.profile)
    return null
  }, [authProfile, isAdmin, isOwnProfile, resolved?.profile])

  const canEditProfile = Boolean(editableProfile && (isOwnProfile || isAdmin))

  const displayName = useMemo(() => {
    const viewedName =
      resolved?.profile?.display_name ??
      resolved?.guestName ??
      routeEntry?.display_name ??
      t('playerProfile.player')
    if (!isOwnProfile) return viewedName
    return authProfile?.display_name ?? viewedName
  }, [
    authProfile?.display_name,
    isOwnProfile,
    resolved?.guestName,
    resolved?.profile?.display_name,
    routeEntry?.display_name,
    t,
  ])

  const avatarUrl = useMemo(() => {
    const viewedAvatar =
      resolved?.profile?.avatar_url ??
      resolved?.guestAvatarUrl ??
      routeEntry?.avatar_url ??
      null
    if (!isOwnProfile) return viewedAvatar
    return authProfile?.avatar_url ?? viewedAvatar
  }, [
    authProfile?.avatar_url,
    isOwnProfile,
    resolved?.guestAvatarUrl,
    resolved?.profile?.avatar_url,
    routeEntry?.avatar_url,
  ])

  useEffect(() => {
    window.scrollTo(0, 0)
    setTab('profile')
  }, [playerId])

  useEffect(() => {
    if (isOwnProfile) void refreshProfile()
  }, [isOwnProfile, refreshProfile])

  useEffect(() => {
    if (!playerId) {
      setResolved(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const result = await resolvePlayerProfile(playerId)
      if (!cancelled) {
        setResolved(result)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playerId])

  const reloadProfile = () => {
    void refreshProfile()
    if (!playerId) return
    void resolvePlayerProfile(playerId).then(setResolved)
  }

  const competitionStats =
    snapshot && routeEntry
      ? {
          rank: snapshot.rank,
          points: routeEntry.total_points,
          games: routeEntry.games,
          unit: snapshot.unit,
        }
      : null

  const badges = routeEntry ? (snapshot?.badges ?? []) : []

  const memberSince = resolved?.profile?.created_at
    ? formatMemberSince(resolved.profile.created_at, locale)
    : null

  const linkablePadelPlayerId = useMemo(() => {
    if (resolved?.linkablePadelPlayerId) return resolved.linkablePadelPlayerId
    if (routeEntry?.padel_player_id && isClaimableGuest(routeEntry)) {
      return routeEntry.padel_player_id
    }
    if (!resolved?.profile) {
      return resolved?.padelPlayerId ?? playerId ?? null
    }
    return null
  }, [playerId, resolved, routeEntry])

  const canConnectLine = useMemo(() => {
    if (!linkablePadelPlayerId) return false
    if (isAdmin) return true
    if (user) return false
    if (routeEntry) return isClaimableGuest(routeEntry)
    return true
  }, [isAdmin, linkablePadelPlayerId, routeEntry, user])

  const padelPlayerId =
    routeEntry?.padel_player_id ??
    resolved?.padelPlayerId ??
    linkablePadelPlayerId ??
    (resolved?.profile ? null : playerId)

  const goBack = () => {
    if (state?.from) navigate(state.from)
    else navigate(-1)
  }

  if (!playerId) {
    return (
      <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
        <AppTopBar>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm font-medium text-brand-accent md:text-base"
          >
            {t('common.back')}
          </button>
        </AppTopBar>
        <main className="flex flex-1 items-center justify-center px-6">
          <p className="text-center text-sm text-brand-muted">{t('playerProfile.notFound')}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <AppTopBar>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            className="shrink-0 text-sm font-medium text-brand-accent md:text-base"
          >
            {t('common.back')}
          </button>
          <p className="min-w-0 truncate text-sm font-medium text-brand-primary md:text-base">
            {displayName}
          </p>
        </div>
      </AppTopBar>

      <main data-scroll-y className="scroll-y min-h-0 min-w-0 flex-1 px-3 pt-2 md:px-6">
        <div className="mx-auto w-full min-w-0 max-w-full space-y-3 pb-8 md:max-w-3xl lg:max-w-4xl">
          {inClient && !loading && !(isOwnProfile && authLoading) ? <LineAppBookmark /> : null}
          {loading || (isOwnProfile && authLoading) ? (
            <p className="py-8 text-center text-sm text-brand-muted">{t('common.loading')}</p>
          ) : (
            <PlayerProfileCard
              tab={tab}
              onTab={setTab}
              banner={
                <PlayerProfileBanner
                  embedded
                  name={displayName}
                  avatarUrl={avatarUrl}
                  memberSince={isOwnProfile ? null : memberSince}
                  canAddLine={canConnectLine}
                  onAddLine={
                    canConnectLine && linkablePadelPlayerId
                      ? () => setLinkTarget({ id: linkablePadelPlayerId, name: displayName })
                      : undefined
                  }
                  onChangePhoto={
                    canEditProfile ? () => fileInputRef.current?.click() : undefined
                  }
                  changePhotoLabel={canEditProfile ? t('profile.changePhoto') : undefined}
                  t={t}
                />
              }
            >
              {tab === 'history' ? (
                <PlayerMatchHistory
                  playerId={profileId ?? padelPlayerId ?? playerId}
                  embedded
                />
              ) : canEditProfile && editableProfile ? (
                <>
                  <ProfileDetailsForm
                    profile={editableProfile}
                    isAdmin={isAdmin}
                    onSaved={reloadProfile}
                    hideBanner
                    fileInputRef={fileInputRef}
                  />
                  {competitionStats && (
                    <section className="border-t border-brand-border/60 px-4 py-3 md:px-5">
                      <h2 className="font-display text-sm font-semibold text-brand-primary md:text-base">
                        {t('playerProfile.competition')}
                      </h2>
                      <p className="mt-2 text-sm text-brand-text">
                        {t('playerProfile.competitionSummary', {
                          rank: competitionStats.rank,
                          points: competitionStats.points,
                          unit: competitionStats.unit,
                          games: competitionStats.games,
                        })}
                      </p>
                    </section>
                  )}
                  {badges.length > 0 && (
                    <PlayerProfileView
                      profile={null}
                      fallbackName={displayName}
                      badges={badges}
                      showDetails={false}
                      embedded
                      t={t}
                    />
                  )}
                </>
              ) : (
                <PlayerProfileView
                  profile={resolved?.profile ?? null}
                  fallbackName={displayName}
                  competitionStats={competitionStats}
                  badges={badges}
                  embedded
                  t={t}
                />
              )}
            </PlayerProfileCard>
          )}
          {isOwnProfile && authProfile && !loading && !authLoading && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="block w-full py-2 text-center text-xs text-brand-muted"
            >
              {t('profile.signOut')}
            </button>
          )}
        </div>
      </main>

      {linkTarget && (
        <LinePlayerLinkModal
          competitionId={competitionId}
          padelPlayerId={linkTarget.id}
          playerName={linkTarget.name}
          onClose={() => setLinkTarget(null)}
        />
      )}
    </div>
  )
}

function formatMemberSince(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}
