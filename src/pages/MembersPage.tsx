import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { clubDisplayName } from '../lib/clubMemberDisplay'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'

type GuestPlayerRow = {
  id: string
  display_name: string
  game_count: number
}

function MemberRow({
  id,
  name,
  avatarUrl,
  isMe,
  lineLinked,
}: {
  id: string
  name: string
  avatarUrl: string | null
  isMe: boolean
  lineLinked?: boolean
}) {
  return (
    <li className="border-b border-brand-border/60 last:border-b-0">
      <Link
        to={`/players/${id}`}
        className={`flex items-center gap-3 px-3 py-3 transition active:bg-brand-bg-alt ${
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
        <span
          className={`min-w-0 flex-1 truncate text-sm font-semibold ${
            isMe ? 'text-brand-accent' : 'text-brand-primary'
          }`}
        >
          {name}
        </span>
        {lineLinked ? (
          <span className="shrink-0 rounded-full bg-[#06C755]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#06C755]">
            LINE
          </span>
        ) : null}
      </Link>
    </li>
  )
}

function MemberSection({
  title,
  empty,
  count,
  children,
}: {
  title: string
  empty?: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{title}</h2>
      {count > 0 ? (
        <ul className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
          {children}
        </ul>
      ) : empty ? (
        <p className="text-sm text-brand-muted">{empty}</p>
      ) : null}
    </section>
  )
}

export function MembersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isAdmin = Boolean(profile?.is_admin)
  const [members, setMembers] = useState<Profile[]>([])
  const [guestPlayers, setGuestPlayers] = useState<GuestPlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createName, setCreateName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [profilesRes, guestsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, line_user_id, is_admin')
        .order('display_name'),
      supabase.rpc('list_guest_players_with_games'),
    ])
    setMembers((profilesRes.data as Profile[]) ?? [])
    setGuestPlayers((guestsRes.data as GuestPlayerRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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
    setCreateBusy(false)
    if (error || !data) {
      setCreateError(error?.message ?? t('members.createFailed'))
      return
    }
    setCreateName('')
    void load()
    navigate(`/players/${data as string}`)
  }

  if (loading) {
    return (
      <div className="px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-1 md:px-6">
        <p className="text-sm text-brand-muted">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-1 md:px-6">
      <h1 className="text-lg font-semibold text-brand-primary">{t('members.title')}</h1>

      <MemberSection
        title={t('members.lineLinked')}
        empty={t('members.noLineMembers')}
        count={lineMembers.length}
      >
        {lineMembers.map((member) => {
          const name = firstDisplayName(clubDisplayName(member.id, member.display_name))
          return (
            <MemberRow
              key={member.id}
              id={member.id}
              name={name}
              avatarUrl={member.avatar_url}
              isMe={user?.id === member.id}
              lineLinked
            />
          )
        })}
      </MemberSection>

      <MemberSection
        title={t('members.otherMembers')}
        empty={t('members.noOtherMembers')}
        count={otherMembers.length}
      >
        {otherMembers.map((member) => {
          const name = firstDisplayName(clubDisplayName(member.id, member.display_name))
          return (
            <MemberRow
              key={member.id}
              id={member.id}
              name={name}
              avatarUrl={member.avatar_url}
              isMe={user?.id === member.id}
            />
          )
        })}
      </MemberSection>

      <MemberSection
        title={t('members.guestPlayers')}
        empty={t('members.noGuestPlayers')}
        count={guestPlayers.length}
      >
        {guestPlayers.map((player) => {
          const name = firstDisplayName(player.display_name)
          return (
            <li key={player.id} className="border-b border-brand-border/60 last:border-b-0">
              <Link
                to={`/players/${player.id}`}
                className="flex items-center gap-3 px-3 py-3 transition active:bg-brand-bg-alt"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-sm font-semibold text-brand-muted ring-1 ring-brand-border/80">
                  {name[0]?.toUpperCase() ?? '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-brand-primary">{name}</span>
                  <p className="text-[10px] text-brand-muted">
                    {t('members.gameInvolvement', { count: player.game_count })}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </MemberSection>

      {isAdmin ? (
        <section className="space-y-2 rounded-2xl border border-brand-border bg-brand-surface p-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {t('members.create')}
          </h2>
          <p className="text-xs text-brand-muted">{t('members.createHint')}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="brand-input min-w-0 flex-1"
              autoComplete="off"
            />
            <button
              type="button"
              disabled={createBusy || !createName.trim()}
              onClick={() => void createPlayer()}
              className="brand-btn shrink-0 px-4 text-sm font-semibold disabled:opacity-50"
            >
              {createBusy ? t('common.loading') : t('members.createAccept')}
            </button>
          </div>
          {createError ? <p className="text-xs text-red-600">{createError}</p> : null}
        </section>
      ) : null}

    </div>
  )
}
