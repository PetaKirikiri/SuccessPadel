import { Share2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { canManageMembers } from '../lib/memberPermissions'
import { DeleteConfirm } from '../shared/Modal/DeleteConfirm'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { adminDeletePlayer, canAdminDeletePlayer } from '../lib/playerDelete'
import { clubDisplayName } from '../lib/clubMemberDisplay'
import { lineHandshakeDebug } from '../lib/debug/lineHandshakeDebug'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { SKILL_LEVELS, type SkillLevel } from '../lib/competitionPresets'
import { profileSkillLabel } from '../lib/profileI18n'
import { playerProfileShareUrl, sharePlayerProfile } from '../lib/playerProfileShare'
import { playerProfilePath } from '../lib/playerProfileSlug'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'

type GuestPlayerRow = {
  id: string
  display_name: string
  game_count: number
  line_user_id?: string | null
  line_picture_url?: string | null
  skill_level?: string | null
}

type PadelLineRow = {
  id: string
  display_name: string
  profile_id: string | null
  line_user_id: string | null
  line_picture_url?: string | null
  skill_level: string | null
}

type DeleteTarget = { id: string; name: string }

function MemberListRow({
  id,
  name,
  avatarUrl,
  isMe,
  subtitle,
  canShare,
  canDelete,
  shareFeedback,
  onShare,
  onDelete,
  skillLevel,
  levelBusy,
  onSkillLevelChange,
  canEditLevel,
}: {
  id: string
  name: string
  avatarUrl: string | null
  isMe: boolean
  subtitle?: string
  canShare: boolean
  canDelete: boolean
  shareFeedback?: string | null
  onShare: () => void
  onDelete: () => void
  skillLevel: string | null
  levelBusy: boolean
  onSkillLevelChange: (level: SkillLevel | null) => void
  canEditLevel: boolean
}) {
  const { t } = useTranslation()

  return (
    <li className="flex items-stretch gap-1 border-b border-brand-border/60 pr-2 last:border-b-0">
      <Link
        to={playerProfilePath({ id, displayName: name })}
        className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-3 transition active:bg-brand-bg-alt ${
          isMe ? 'bg-brand-accent/5' : ''
        }`}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-brand-border/80"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-sm font-semibold text-brand-muted ring-1 ring-brand-border/80">
            {name[0]?.toUpperCase() ?? '?'}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm font-semibold ${
              isMe ? 'text-brand-accent' : 'text-brand-primary'
            }`}
          >
            {name}
          </span>
          {subtitle ? <p className="text-[10px] text-brand-muted">{subtitle}</p> : null}
          {shareFeedback ? (
            <p className="text-[10px] font-medium text-brand-muted">{shareFeedback}</p>
          ) : null}
        </div>
      </Link>
      {canEditLevel ? (
        <select
          value={skillLevel ?? ''}
          disabled={levelBusy}
          aria-label={t('members.playerLevelFor', { name })}
          className="member-level-select"
          onChange={(event) => {
            const value = event.target.value
            onSkillLevelChange(value ? (value as SkillLevel) : null)
          }}
        >
          <option value="">{t('members.levelUnassigned')}</option>
          {SKILL_LEVELS.map((level) => (
            <option key={level} value={level}>
              {profileSkillLabel(level, t)}
            </option>
          ))}
        </select>
      ) : null}
      {canShare ? (
        <button
          type="button"
          onClick={onShare}
          aria-label={t('playerProfile.shareProfile')}
          className="my-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-bg-alt text-brand-primary active:scale-[0.98]"
        >
          <Share2 className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('playerProfile.deletePlayer')}
          className="my-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 active:scale-[0.98]"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </li>
  )
}

function canDeleteMember(
  member: Profile,
  padelLineByProfileId: Map<string, string>,
  userId: string | undefined,
  isAdmin: boolean,
): boolean {
  return canAdminDeletePlayer(
    {
      id: member.id,
      kind: 'profile',
      lineUserId: member.line_user_id ?? padelLineByProfileId.get(member.id) ?? null,
      isAdmin: member.is_admin,
    },
    userId,
    isAdmin,
  )
}

function MemberSection({
  title,
  empty,
  count,
  headerAction,
  addon,
  children,
}: {
  title: string
  empty?: string
  count: number
  headerAction?: React.ReactNode
  addon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{title}</h2>
        {headerAction}
      </div>
      {addon}
      {count > 0 ? (
        <ul className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
          {children}
        </ul>
      ) : addon ? null : empty ? (
        <p className="text-sm text-brand-muted">{empty}</p>
      ) : null}
    </section>
  )
}

export function MembersPage() {
  const { t } = useTranslation()
  const { user, profile, loading: authLoading, session, restoreSession } = useAuth()
  const isAdmin = canManageMembers(authLoading, user?.id, profile)
  // Enable only after admin_set_player_skill_level is available in production.
  const canEditLevels = isAdmin && import.meta.env.VITE_MEMBER_LEVEL_EDITING === 'true'
  const location = useLocation()
  const createInput = useRef<HTMLInputElement>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [linePadelPlayers, setLinePadelPlayers] = useState<GuestPlayerRow[]>([])
  const [guestPlayers, setGuestPlayers] = useState<GuestPlayerRow[]>([])
  const [padelLineByProfileId, setPadelLineByProfileId] = useState<Map<string, string>>(() => new Map())
  const [initialLoading, setInitialLoading] = useState(true)
  const [createName, setCreateName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [shareFeedback, setShareFeedback] = useState<{ id: string; message: string } | null>(null)
  const [levelBusyId, setLevelBusyId] = useState<string | null>(null)
  const [levelError, setLevelError] = useState<string | null>(null)
  const firstLoad = useRef(true)

  useEffect(() => {
    if (!isAdmin || initialLoading || new URLSearchParams(location.search).get('add') !== '1') return
    createInput.current?.scrollIntoView({ block: 'center' })
    createInput.current?.focus({ preventScroll: true })
  }, [isAdmin, initialLoading, location.search])

  const load = useCallback(async () => {
    if (firstLoad.current) setInitialLoading(true)
    const liveSession = session?.user ? session : await restoreSession()
    if (!liveSession?.user) {
      setMembers([])
      setLinePadelPlayers([])
      setGuestPlayers([])
      setPadelLineByProfileId(new Map())
      setInitialLoading(false)
      firstLoad.current = false
      return
    }

    const [profilesRes, guestsRes, padelRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, line_user_id, is_admin, skill_level')
        .order('display_name'),
      supabase.rpc('list_guest_players_with_games'),
      supabase
        .from('padel_players')
        .select('id, display_name, profile_id, line_user_id, line_picture_url, skill_level')
        .order('display_name'),
    ])
    setMembers((profilesRes.data as Profile[]) ?? [])
    const lineMap = new Map<string, string>()
    const skillByPadelId = new Map<string, string | null>()
    const linkedPadelPlayers: GuestPlayerRow[] = []
    for (const row of (padelRes.data as PadelLineRow[] | null) ?? []) {
      skillByPadelId.set(row.id, row.skill_level)
      if (row.profile_id && row.line_user_id?.trim()) {
        lineMap.set(row.profile_id, row.line_user_id)
      } else if (row.line_user_id?.trim()) {
        linkedPadelPlayers.push({
          id: row.id,
          display_name: row.display_name,
          line_user_id: row.line_user_id,
          line_picture_url: row.line_picture_url ?? null,
          skill_level: row.skill_level,
          game_count: 0,
        })
      }
    }
    setPadelLineByProfileId(lineMap)
    setLinePadelPlayers(linkedPadelPlayers)
    setGuestPlayers(
      ((guestsRes.data as GuestPlayerRow[]) ?? []).map((row) => ({
        ...row,
        skill_level: skillByPadelId.get(row.id) ?? null,
      })),
    )
    setInitialLoading(false)
    firstLoad.current = false
  }, [restoreSession, session])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    // #region agent log
    lineHandshakeDebug('M1-admin', 'MembersPage.tsx:state', 'members admin UI state', 'H1', {
      isAdmin,
      authLoading,
      profileIsAdmin: profile?.is_admin ?? null,
      initialLoading,
      hasSession: Boolean(session?.user),
      userIdPrefix: user?.id?.slice(0, 8) ?? null,
    })
    // #endregion
  }, [isAdmin, authLoading, profile?.is_admin, initialLoading, session?.user, user?.id])

  const lineMembers = useMemo(
    () =>
      members.filter((m) =>
        Boolean(m.line_user_id?.trim() || padelLineByProfileId.get(m.id)?.trim()),
      ),
    [members, padelLineByProfileId],
  )

  const otherMembers = useMemo(
    () =>
      members.filter(
        (m) => !m.line_user_id?.trim() && !padelLineByProfileId.get(m.id)?.trim(),
      ),
    [members, padelLineByProfileId],
  )

  const createPlayer = async () => {
    const name = createName.trim()
    if (!isAdmin || createBusy || !name) return
    setCreateBusy(true)
    setCreateError(null)
    const { data, error } = await supabase.rpc('find_or_create_padel_player', {
      p_display_name: name,
      p_guest_email: null,
      p_profile_id: null,
    })
    if (error || !data) {
      setCreateBusy(false)
      setCreateError(error?.message ?? t('members.createFailed'))
      return
    }
    const playerId = data as string
    setCreateName('')
    await load()
    setCreateBusy(false)
    await handleShare(playerId, firstDisplayName(name))
  }

  const createPlayerForm = isAdmin ? (
    <div id="add-member" role="region" aria-label={t('members.addMember')} className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-sm font-semibold text-brand-muted ring-1 ring-brand-border/80">
          +
        </span>
        <input
          ref={createInput}
          aria-label={t('members.createPlaceholder')}
          type="text"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && createName.trim() && !createBusy) {
              void createPlayer()
            }
          }}
          placeholder={t('members.createPlaceholder')}
          className="brand-input min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus:ring-0"
          autoComplete="off"
        />
        <button
          type="button"
          disabled={createBusy || !createName.trim()}
          onClick={() => void createPlayer()}
          className="brand-btn shrink-0 px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {createBusy ? t('common.loading') : t('members.createAccept')}
        </button>
      </div>
      {createError ? <p className="px-3 pb-3 text-xs text-red-600">{createError}</p> : null}
    </div>
  ) : null

  const handleShare = async (id: string, name: string) => {
    const { data } = await supabase.rpc('ensure_linkable_padel_player', { p_player_id: id })
    const shareId = (data as string | null) ?? id
    const url = playerProfileShareUrl(shareId, null, name)
    const result = await sharePlayerProfile({
      url,
      title: name,
      text: `${t('playerProfile.shareProfileMessage')}\n${url}`,
    })
    if (result === 'copied') {
      setShareFeedback({ id: shareId, message: t('playerProfile.linkCopied') })
      window.setTimeout(() => setShareFeedback(null), 2500)
    } else if (result === 'failed') {
      setShareFeedback({ id: shareId, message: t('playerProfile.copyFailed') })
      window.setTimeout(() => setShareFeedback(null), 2500)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    setDeleteError(null)
    const error = await adminDeletePlayer(deleteTarget.id)
    setDeleteBusy(false)
    if (error) {
      setDeleteError(error)
      return
    }
    setDeleteTarget(null)
    void load()
  }

  const saveSkillLevel = async ({
    rowId,
    profileId,
    padelPlayerId,
    level,
  }: {
    rowId: string
    profileId?: string | null
    padelPlayerId?: string | null
    level: SkillLevel | null
  }) => {
    setLevelBusyId(rowId)
    setLevelError(null)
    const { error } = await supabase.rpc('admin_set_player_skill_level', {
      p_padel_player_id: padelPlayerId ?? null,
      p_profile_id: profileId ?? null,
      p_skill_level: level,
    })
    if (error) {
      setLevelError(error.message || t('members.levelSaveFailed'))
      setLevelBusyId(null)
      return
    }
    await load()
    setLevelBusyId(null)
  }

  const renderMemberRow = (member: Profile) => {
    const name = firstDisplayName(clubDisplayName(member.id, member.display_name))
    return (
      <MemberListRow
        key={member.id}
        id={member.id}
        name={name}
        avatarUrl={member.avatar_url}
        isMe={user?.id === member.id}
        canShare={isAdmin}
        canDelete={canDeleteMember(member, padelLineByProfileId, user?.id, isAdmin)}
        shareFeedback={shareFeedback?.id === member.id ? shareFeedback.message : null}
        onShare={() => void handleShare(member.id, name)}
        onDelete={() => {
          setDeleteError(null)
          setDeleteTarget({ id: member.id, name })
        }}
        skillLevel={member.skill_level}
        levelBusy={levelBusyId === member.id}
        onSkillLevelChange={(level) =>
          void saveSkillLevel({ rowId: member.id, profileId: member.id, level })
        }
        canEditLevel={canEditLevels}
      />
    )
  }

  if (initialLoading || (user && !profile && authLoading)) {
    return (
      <div className="px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-1 md:px-6">
        <p className="text-sm text-brand-muted">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-1 md:px-6">
      <h1 className="text-lg font-semibold text-brand-primary">{t('members.title')}</h1>

      {canEditLevels ? <p className="member-level-intro">{t('members.levelIntro')}</p> : null}
      {levelError ? <p className="member-level-error">{levelError}</p> : null}

      {isAdmin ? createPlayerForm : null}

      <MemberSection
        title={t('members.lineLinked')}
        empty={t('members.noLineMembers')}
        count={lineMembers.length + linePadelPlayers.length}
      >
        {lineMembers.map(renderMemberRow)}
        {linePadelPlayers.map((player) => {
          const name = firstDisplayName(player.display_name)
          return (
            <MemberListRow
              key={player.id}
              id={player.id}
              name={name}
              avatarUrl={player.line_picture_url ?? null}
              isMe={false}
              subtitle={t('members.gameInvolvement', { count: player.game_count })}
              canShare={isAdmin}
              canDelete={false}
              shareFeedback={shareFeedback?.id === player.id ? shareFeedback.message : null}
              onShare={() => void handleShare(player.id, name)}
              onDelete={() => {
                setDeleteError(null)
                setDeleteTarget({ id: player.id, name })
              }}
              skillLevel={player.skill_level ?? null}
              levelBusy={levelBusyId === player.id}
              onSkillLevelChange={(level) =>
                void saveSkillLevel({ rowId: player.id, padelPlayerId: player.id, level })
              }
              canEditLevel={canEditLevels}
            />
          )
        })}
      </MemberSection>

      <MemberSection
        title={t('members.otherMembers')}
        empty={t('members.noOtherMembers')}
        count={otherMembers.length}
      >
        {otherMembers.map(renderMemberRow)}
      </MemberSection>

      <MemberSection
        title={t('members.guestPlayers')}
        empty={t('members.noGuestPlayers')}
        count={guestPlayers.length}
      >
        {guestPlayers.map((player) => {
          const name = firstDisplayName(player.display_name)
          return (
            <MemberListRow
              key={player.id}
              id={player.id}
              name={name}
              avatarUrl={null}
              isMe={false}
              subtitle={t('members.gameInvolvement', { count: player.game_count })}
              canShare={isAdmin}
              canDelete={canAdminDeletePlayer(
                { id: player.id, kind: 'guest_padel', lineUserId: player.line_user_id },
                user?.id,
                isAdmin,
              )}
              shareFeedback={shareFeedback?.id === player.id ? shareFeedback.message : null}
              onShare={() => void handleShare(player.id, name)}
              onDelete={() => {
                setDeleteError(null)
                setDeleteTarget({ id: player.id, name })
              }}
              skillLevel={player.skill_level ?? null}
              levelBusy={levelBusyId === player.id}
              onSkillLevelChange={(level) =>
                void saveSkillLevel({ rowId: player.id, padelPlayerId: player.id, level })
              }
              canEditLevel={canEditLevels}
            />
          )
        })}
      </MemberSection>

      {deleteTarget ? (
        <DeleteConfirm
          title={deleteTarget.name}
          message={
            deleteError ??
            t('playerProfile.deletePlayerConfirm', { name: deleteTarget.name })
          }
          busy={deleteBusy}
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => {
            setDeleteTarget(null)
            setDeleteError(null)
          }}
        />
      ) : null}
    </div>
  )
}
