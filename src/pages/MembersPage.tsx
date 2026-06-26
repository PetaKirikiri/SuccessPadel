import { Share2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FriendlyDeleteConfirm } from '../components/FriendlyDeleteConfirm'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { adminDeletePlayer, canAdminDeletePlayer } from '../lib/playerDelete'
import { clubDisplayName } from '../lib/clubMemberDisplay'
import { lineHandshakeDebug } from '../lib/debug/lineHandshakeDebug'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { playerProfileShareUrl, sharePlayerProfile } from '../lib/playerProfileShare'
import { playerProfilePath } from '../lib/playerProfileSlug'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'

type GuestPlayerRow = {
  id: string
  display_name: string
  game_count: number
  line_user_id?: string | null
}

type PadelLineRow = {
  profile_id: string
  line_user_id: string | null
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
  const { user, profile, loading: authLoading } = useAuth()
  const isAdmin = !authLoading && Boolean(profile?.is_admin)
  const [members, setMembers] = useState<Profile[]>([])
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
  const firstLoad = useRef(true)

  const load = useCallback(async () => {
    if (firstLoad.current) setInitialLoading(true)
    const [profilesRes, guestsRes, padelRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, line_user_id, is_admin')
        .order('display_name'),
      supabase.rpc('list_guest_players_with_games'),
      supabase.from('padel_players').select('profile_id, line_user_id').not('profile_id', 'is', null),
    ])
    setMembers((profilesRes.data as Profile[]) ?? [])
    setGuestPlayers((guestsRes.data as GuestPlayerRow[]) ?? [])
    const lineMap = new Map<string, string>()
    for (const row of (padelRes.data as PadelLineRow[] | null) ?? []) {
      if (row.profile_id && row.line_user_id?.trim()) {
        lineMap.set(row.profile_id, row.line_user_id)
      }
    }
    setPadelLineByProfileId(lineMap)
    setInitialLoading(false)
    firstLoad.current = false
  }, [])

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
      userIdPrefix: user?.id?.slice(0, 8) ?? null,
    })
    // #endregion
  }, [isAdmin, authLoading, profile?.is_admin, initialLoading, user?.id])

  const lineMembers = useMemo(
    () => members.filter((m) => Boolean(m.line_user_id?.trim())),
    [members],
  )

  const otherMembers = useMemo(
    () => members.filter((m) => !m.line_user_id?.trim()),
    [members],
  )

  const createPlayer = async () => {
    const name = createName.trim()
    if (!name) return
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
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-sm font-semibold text-brand-muted ring-1 ring-brand-border/80">
          +
        </span>
        <input
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

      {isAdmin ? createPlayerForm : null}

      <MemberSection
        title={t('members.lineLinked')}
        empty={t('members.noLineMembers')}
        count={lineMembers.length}
      >
        {lineMembers.map(renderMemberRow)}
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
            />
          )
        })}
      </MemberSection>

      {deleteTarget ? (
        <FriendlyDeleteConfirm
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
