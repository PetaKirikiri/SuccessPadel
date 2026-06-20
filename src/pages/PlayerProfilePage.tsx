import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppTopBar } from '../components/AppTopBar'
import { AppBottomNav } from '../components/AppBottomNav'
import { AppShellColumn } from '../components/AppShellColumn'
import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
import { FriendlyDeleteConfirm } from '../components/FriendlyDeleteConfirm'
import { LineAppBookmark } from '../components/LineAppBookmark'
import { LinePlayerLinkModal } from '../components/LinePlayerLinkModal'
import { LinePlayerLinkPanel } from '../components/LinePlayerLinkPanel'
import { PlayerMatchHistory } from '../components/PlayerMatchHistory'
import { PlayerProfileBanner } from '../components/PlayerProfileBanner'
import { PlayerProfileCard } from '../components/PlayerProfileCard'
import type { PlayerProfileTab } from '../components/PlayerProfileTabs'
import { PlayerProfileDetailsDisplay } from '../components/PlayerProfileDetailsDisplay'
import { ProfileDetailsForm, type EditableProfile } from '../components/ProfileDetailsForm'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useTranslation } from '../hooks/useTranslation'
import { useLocale } from '../providers/LocaleProvider'
import { isClaimableGuest } from '../lib/leaderboardEntries'
import { resolvePlayerProfile } from '../lib/playerProfile'
import { saveClaimPadelPlayer } from '../lib/authClaimPlayer'
import { adminDeletePlayer, canAdminDeletePlayer } from '../lib/playerDelete'
import { playerProfileShareUrl, sharePlayerProfile } from '../lib/playerProfileShare'
import { uploadProfileAvatar, validateProfileAvatar } from '../lib/profileAvatar'
import { isLineLiffBrowser } from '../lib/line/liff'
import { runLinePlayerProfileHandshake } from '../lib/line/profileHandshake'
import { supabase } from '../lib/supabaseClient'
import type { PlayerProfileSnapshot } from '../lib/openPlayerProfile'

export type { PlayerProfileSnapshot }

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
  const photoInputId = useId()

  const [resolved, setResolved] = useState<Awaited<ReturnType<typeof resolvePlayerProfile>> | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [linkTarget, setLinkTarget] = useState<{ id: string; name: string } | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [tab, setTab] = useState<PlayerProfileTab>('profile')
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [ownedPadelPlayerId, setOwnedPadelPlayerId] = useState<string | null>(null)
  const [lineHandshakeWorking, setLineHandshakeWorking] = useState(false)
  const [lineHandshakeError, setLineHandshakeError] = useState<string | null>(null)
  const lineHandshakeStarted = useRef(false)

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

  const isOwnProfile = useMemo(
    () =>
      Boolean(
        user?.id &&
          (user.id === playerId ||
            user.id === resolved?.profile?.id ||
            (linkablePadelPlayerId && ownedPadelPlayerId === linkablePadelPlayerId) ||
            (resolved?.padelPlayerId && ownedPadelPlayerId === resolved.padelPlayerId)),
      ),
    [
      user?.id,
      playerId,
      resolved?.profile?.id,
      resolved?.padelPlayerId,
      linkablePadelPlayerId,
      ownedPadelPlayerId,
    ],
  )

  const editableProfile = useMemo(() => {
    if (isOwnProfile && authProfile) return toEditableProfile(authProfile)
    if (isAdmin && resolved?.profile) return toEditableProfile(resolved.profile)
    if (isOwnProfile && resolved?.profile) return toEditableProfile(resolved.profile)
    return null
  }, [authProfile, isAdmin, isOwnProfile, resolved?.profile])

  const canEditProfile = Boolean(editableProfile && (isOwnProfile || isAdmin))

  const handleAvatarPick = async (file: File | undefined) => {
    if (!file || !editableProfile || avatarBusy) return
    const validationError = validateProfileAvatar(file)
    if (validationError) {
      setAvatarError(validationError)
      return
    }
    setAvatarError(null)
    setAvatarBusy(true)
    try {
      const url = await uploadProfileAvatar(editableProfile.id, file)
      const { error: err } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', editableProfile.id)
      if (err) throw new Error(err.message)
      window.dispatchEvent(new Event('successpadel:profile-synced'))
      reloadProfile()
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : t('profile.photoUploadFailed'))
    } finally {
      setAvatarBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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

  const needsPlayerSignup = Boolean(
    linkablePadelPlayerId || (resolved?.profile && !resolved.profile.line_user_id),
  )

  const canConnectLine = useMemo(() => {
    if (!linkablePadelPlayerId) return false
    if (resolved?.profile?.line_user_id || resolved?.padelLineUserId) return false
    if (
      ownedPadelPlayerId &&
      (ownedPadelPlayerId === linkablePadelPlayerId ||
        ownedPadelPlayerId === resolved?.padelPlayerId)
    ) {
      return false
    }
    if (isAdmin) return true
    if (user && resolved?.profile && resolved.profile.id !== user.id) return false
    if (routeEntry && user) return isClaimableGuest(routeEntry)
    return true
  }, [
    isAdmin,
    linkablePadelPlayerId,
    ownedPadelPlayerId,
    resolved?.padelLineUserId,
    resolved?.padelPlayerId,
    resolved?.profile,
    routeEntry,
    user,
  ])

  const showInlineLineSetup = Boolean(
    needsPlayerSignup && linkablePadelPlayerId && !canEditProfile && canConnectLine && !inClient,
  )

  const playerNotFound = Boolean(
    !loading &&
      resolved &&
      !resolved.profile &&
      !resolved.guestName &&
      !resolved.padelPlayerId,
  )

  useEffect(() => {
    if (loading || authLoading || user) return
    if (!isLineLiffBrowser() && !inClient) return
    if (!linkablePadelPlayerId || !canConnectLine) return
    if (lineHandshakeStarted.current) return

    lineHandshakeStarted.current = true
    setLineHandshakeWorking(true)
    setLineHandshakeError(null)

    void runLinePlayerProfileHandshake(linkablePadelPlayerId).then((result) => {
      if (result.redirected) {
        setLineHandshakeWorking(false)
        lineHandshakeStarted.current = false
        return
      }

      setLineHandshakeWorking(false)

      if (result.error) {
        setLineHandshakeError(result.error)
        lineHandshakeStarted.current = false
        return
      }

      reloadProfile()
    })
  }, [
    loading,
    authLoading,
    user,
    inClient,
    linkablePadelPlayerId,
    canConnectLine,
    competitionId,
    navigate,
  ])

  useEffect(() => {
    if (loading || !linkablePadelPlayerId || resolved?.profile) return
    if (resolved?.padelLineUserId) return
    if (isLineLiffBrowser() || inClient) return
    saveClaimPadelPlayer(linkablePadelPlayerId)
  }, [linkablePadelPlayerId, loading, resolved?.padelLineUserId, resolved?.profile, inClient])

  useEffect(() => {
    if (!user?.id) {
      setOwnedPadelPlayerId(null)
      return
    }
    let active = true
    void supabase
      .from('padel_players')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setOwnedPadelPlayerId(data?.id ?? null)
      })
    return () => {
      active = false
    }
  }, [user?.id, resolved?.profile?.id, resolved?.padelLineUserId])

  useEffect(() => {
    if (!user?.id || !playerId) return
    reloadProfile()
  }, [user?.id, playerId])

  useEffect(() => {
    const onProfileSynced = () => reloadProfile()
    window.addEventListener('successpadel:profile-synced', onProfileSynced)
    return () => window.removeEventListener('successpadel:profile-synced', onProfileSynced)
  }, [user?.id, playerId])

  useEffect(() => {
    if (!showInlineLineSetup || !playerId) return
    const poll = window.setInterval(() => {
      void resolvePlayerProfile(playerId).then(setResolved)
      if (user?.id) void refreshProfile()
    }, 3000)
    return () => window.clearInterval(poll)
  }, [showInlineLineSetup, playerId, user?.id, refreshProfile])

  const canShareProfile = isAdmin && needsPlayerSignup

  const canDeletePlayer = useMemo(() => {
    if (!isAdmin || !playerId) return false
    return canAdminDeletePlayer(
      {
        id: resolved?.profile?.id ?? resolved?.padelPlayerId ?? playerId,
        kind: resolved?.profile ? 'profile' : 'guest_padel',
        lineUserId: resolved?.profile?.line_user_id ?? resolved?.padelLineUserId,
        isAdmin: resolved?.profile?.is_admin,
      },
      user?.id,
      isAdmin,
    )
  }, [isAdmin, playerId, resolved, user?.id])

  const adminDeleteTargetId = useMemo(() => {
    if (resolved?.profile) return resolved.profile.id
    return resolved?.padelPlayerId ?? playerId ?? null
  }, [playerId, resolved])

  const profileSharePlayerId = linkablePadelPlayerId ?? playerId ?? null

  const handleShareProfile = async () => {
    if (!profileSharePlayerId) return
    const { data } = await supabase.rpc('ensure_linkable_padel_player', {
      p_player_id: profileSharePlayerId,
    })
    const shareId = (data as string | null) ?? profileSharePlayerId
    const url = playerProfileShareUrl(shareId, competitionId)
    const result = await sharePlayerProfile({
      url,
      title: displayName,
      text: `${t('playerProfile.shareProfileMessage')}\n${url}`,
    })
    if (result === 'copied') {
      setShareFeedback(t('playerProfile.linkCopied'))
      window.setTimeout(() => setShareFeedback(null), 2500)
    } else if (result === 'failed') {
      setShareFeedback(t('playerProfile.copyFailed'))
      window.setTimeout(() => setShareFeedback(null), 2500)
    }
  }

  const handleDeletePlayer = async () => {
    if (!adminDeleteTargetId) return
    setDeleteBusy(true)
    setDeleteError(null)
    const error = await adminDeletePlayer(adminDeleteTargetId)
    setDeleteBusy(false)
    if (error) {
      setDeleteError(error)
      return
    }
    setDeleteOpen(false)
    navigate('/members', { replace: true })
  }

  const padelPlayerId =
    routeEntry?.padel_player_id ??
    resolved?.padelPlayerId ??
    linkablePadelPlayerId ??
    (resolved?.profile ? null : playerId)

  const exitPath = competitionId ? `/competitions/${competitionId}` : '/friendly'

  const goBack = () => {
    const here = `${location.pathname}${location.search}`
    if (state?.from && state.from !== here) {
      navigate(state.from)
      return
    }
    navigate(exitPath)
  }

  if (!playerId) {
    return (
      <div className="game-bg flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopBar>
          <button
            type="button"
            onClick={() => navigate('/friendly')}
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
    <div className="game-bg flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
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

      {canEditProfile && editableProfile ? (
        <input
          id={photoInputId}
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={avatarBusy}
          onChange={(e) => void handleAvatarPick(e.target.files?.[0])}
        />
      ) : null}

      <main
        data-scroll-y
        className="scroll-y min-h-0 min-w-0 flex-1 pt-2 pb-[calc(var(--app-shell-dock-height)+0.5rem)]"
      >
        <AppShellColumn fill={false} className="space-y-3 pb-8">
          {lineHandshakeWorking ? (
            <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center bg-white/80 px-6">
              <p className="text-center text-sm text-brand-muted">{t('lineLink.signingInLine')}</p>
            </div>
          ) : null}
          {lineHandshakeError ? (
            <div className="mx-4 rounded-lg border border-red-200 bg-white px-3 py-2 text-center text-xs text-red-600">
              {lineHandshakeError}
            </div>
          ) : null}
          {inClient && !loading && !(isOwnProfile && authLoading) ? <LineAppBookmark /> : null}
          {loading || (isOwnProfile && authLoading) ? (
            <p className="py-8 text-center text-sm text-brand-muted">{t('common.loading')}</p>
          ) : playerNotFound ? (
            <p className="py-8 text-center text-sm text-brand-muted">{t('playerProfile.notFound')}</p>
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
                  canAddLine={canConnectLine && !showInlineLineSetup}
                  onAddLine={
                    canConnectLine && linkablePadelPlayerId && !showInlineLineSetup
                      ? () => setLinkTarget({ id: linkablePadelPlayerId, name: displayName })
                      : undefined
                  }
                  canShareProfile={canShareProfile}
                  onShareProfile={canShareProfile ? () => void handleShareProfile() : undefined}
                  shareProfileLabel={t('playerProfile.shareProfile')}
                  shareFeedback={shareFeedback}
                  photoInputId={canEditProfile && !avatarBusy ? photoInputId : undefined}
                  changePhotoLabel={
                    canEditProfile
                      ? avatarBusy
                        ? t('common.loading')
                        : t('profile.changePhoto')
                      : undefined
                  }
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
                  {avatarError ? (
                    <p className="px-4 text-center text-xs text-red-600 md:px-5">{avatarError}</p>
                  ) : null}
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
                    <PlayerProfileDetailsDisplay
                      profile={null}
                      fallbackName={displayName}
                      badges={badges}
                      showDetails={false}
                      t={t}
                    />
                  )}
                </>
              ) : showInlineLineSetup && linkablePadelPlayerId ? (
                <>
                  <LinePlayerLinkPanel
                    embedded
                    competitionId={competitionId}
                    padelPlayerId={linkablePadelPlayerId}
                    playerName={displayName}
                  />
                  {resolved?.profile ? (
                    <PlayerProfileDetailsDisplay
                      profile={resolved.profile}
                      fallbackName={displayName}
                      competitionStats={competitionStats}
                      badges={badges}
                      t={t}
                    />
                  ) : null}
                </>
              ) : (
                <PlayerProfileDetailsDisplay
                  profile={resolved?.profile ?? null}
                  fallbackName={displayName}
                  competitionStats={competitionStats}
                  badges={badges}
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
          {canDeletePlayer && !loading && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null)
                  setDeleteOpen(true)
                }}
                className="block w-full py-2 text-center text-xs font-medium text-red-600"
              >
                {t('playerProfile.deletePlayer')}
              </button>
              {deleteError ? (
                <p className="text-center text-xs text-red-600">{deleteError}</p>
              ) : null}
            </>
          )}
        </AppShellColumn>
      </main>

      <AppBottomNav />

      {linkTarget && (
        <LinePlayerLinkModal
          competitionId={competitionId}
          padelPlayerId={linkTarget.id}
          playerName={linkTarget.name}
          onClose={() => setLinkTarget(null)}
        />
      )}

      {deleteOpen && (
        <FriendlyDeleteConfirm
          title={displayName}
          message={
            deleteError ?? t('playerProfile.deletePlayerConfirm', { name: displayName })
          }
          busy={deleteBusy}
          onConfirm={() => void handleDeletePlayer()}
          onCancel={() => {
            setDeleteOpen(false)
            setDeleteError(null)
          }}
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
