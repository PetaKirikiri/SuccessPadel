import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { clubDisplayName } from '../lib/clubMemberDisplay'
import type { Profile } from '../lib/types'
import { PlayerAvatarLink } from './PlayerAvatarLink'

export type PadelPlayerOption = {
  id: string
  display_name: string
  profile_id: string | null
}

type Props = {
  count: number
  profiles: Profile[]
  padelPlayers?: PadelPlayerOption[]
  names: string[]
  profileIds: (string | null)[]
  padelPlayerIds?: (string | null)[]
  onChange: (
    names: string[],
    profileIds: (string | null)[],
    padelPlayerIds: (string | null)[],
  ) => void
  onAdd?: () => void
  canAdd?: boolean
  addLabel?: string
  disabled?: boolean
  showMembers?: boolean
  showPlayerProfiles?: boolean
  /** `text` = direct name fields; `picker` = member/padel combobox (setup form). */
  nameInputMode?: 'text' | 'picker'
  linkAvatarsToProfile?: boolean
  competitionId?: string | null
}

type Suggestion =
  | { kind: 'member'; profile: Profile }
  | { kind: 'player'; player: PadelPlayerOption }

function pad<T>(values: T[], count: number, fill: T): T[] {
  const next = values.slice(0, count)
  while (next.length < count) next.push(fill)
  return next
}

function filterByQuery(items: Suggestion[], query: string): Suggestion[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => {
    const name =
      item.kind === 'member'
        ? clubDisplayName(item.profile.id, item.profile.display_name)
        : item.player.display_name
    return name.toLowerCase().includes(q)
  })
}

function MemberAvatar({ url, size = 'md' }: { url: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-9 w-9' : 'h-7 w-7'
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      className={`${dim} shrink-0 rounded-full object-cover ring-1 ring-brand-border/80`}
    />
  )
}

function SlotAvatar({ url, name }: { url: string | null; name: string }) {
  const trimmed = name.trim()
  const initial = trimmed[0]?.toUpperCase() ?? '?'
  if (url) {
    return <MemberAvatar size="lg" url={url} />
  }
  if (trimmed) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-sm font-semibold text-brand-muted ring-1 ring-brand-border/80">
        {initial}
      </span>
    )
  }
  return (
    <span
      className="h-9 w-9 shrink-0 rounded-full bg-brand-bg-alt/40 ring-1 ring-brand-border/40"
      aria-hidden
    />
  )
}

const PlayerSlotCombobox = memo(function PlayerSlotCombobox({
  availableMembers,
  availablePlayers,
  value,
  disabled,
  showMembers,
  showPlayerProfiles,
  onPick,
}: {
  availableMembers: Profile[]
  availablePlayers: PadelPlayerOption[]
  value: string
  disabled?: boolean
  showMembers: boolean
  showPlayerProfiles: boolean
  onPick: (name: string, profileId: string | null, padelPlayerId: string | null) => void
}) {
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    setText(value)
  }, [value])

  const allSuggestions = useMemo(() => {
    const items: Suggestion[] = []
    if (showMembers) {
      for (const profile of availableMembers) {
        items.push({ kind: 'member', profile })
      }
    }
    if (showPlayerProfiles) {
      for (const player of availablePlayers) {
        items.push({ kind: 'player', player })
      }
    }
    return items
  }, [availableMembers, availablePlayers, showMembers, showPlayerProfiles])

  const suggestions = useMemo(() => filterByQuery(allSuggestions, text), [allSuggestions, text])

  useEffect(() => {
    if (!open) setActiveIndex(-1)
    else if (suggestions.length > 0) setActiveIndex(0)
  }, [open, suggestions.length])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const pickSuggestion = (item: Suggestion) => {
    if (item.kind === 'member') {
      onPick(item.profile.display_name, item.profile.id, null)
      setText(item.profile.display_name)
    } else {
      onPick(item.player.display_name, null, item.player.id)
      setText(item.player.display_name)
    }
    setOpen(false)
  }

  const commit = (nextText: string) => {
    const trimmed = nextText.trim()
    if (!trimmed) {
      onPick('', null, null)
      return
    }
    const memberExact = showMembers
      ? availableMembers.find(
          (p) =>
            clubDisplayName(p.id, p.display_name).toLowerCase() === trimmed.toLowerCase() ||
            p.display_name.toLowerCase() === trimmed.toLowerCase(),
        )
      : null
    if (memberExact) {
      onPick(memberExact.display_name, memberExact.id, null)
      return
    }
    const playerExact = showPlayerProfiles
      ? availablePlayers.find((p) => p.display_name.toLowerCase() === trimmed.toLowerCase())
      : null
    if (playerExact) {
      onPick(playerExact.display_name, null, playerExact.id)
      return
    }
    onPick(trimmed, null, null)
  }

  const selectAt = (idx: number) => {
    const item = suggestions[idx]
    if (item) pickSuggestion(item)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        value={text}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false)
            commit(text)
          }, 150)
        }}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) {
            if (e.key === 'ArrowDown' && suggestions.length > 0) {
              e.preventDefault()
              setOpen(true)
              setActiveIndex(0)
            }
            if (e.key === 'Enter') e.currentTarget.blur()
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => (i + 1) % suggestions.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (activeIndex >= 0) selectAt(activeIndex)
            else e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className="brand-input h-9 min-w-0 w-full py-1 text-sm"
        autoComplete="off"
      />
      {open && suggestions.length > 0 ? (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-0.5 max-h-52 overflow-y-auto overscroll-contain rounded-lg border border-brand-border bg-brand-surface py-0.5 shadow-md"
        >
          {suggestions.map((item, i) => {
            const prev = suggestions[i - 1]
            const showHeader =
              item.kind === 'member'
                ? showMembers && (i === 0 || prev?.kind !== 'member')
                : showPlayerProfiles && (i === 0 || prev?.kind !== 'player')
            const label =
              item.kind === 'member'
                ? clubDisplayName(item.profile.id, item.profile.display_name)
                : item.player.display_name
            const avatar = item.kind === 'member' ? item.profile.avatar_url : null
            return (
              <li key={item.kind === 'member' ? `m-${item.profile.id}` : `p-${item.player.id}`}>
                {showHeader ? (
                  <span className="block px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                    {item.kind === 'member' ? 'Members' : 'Player profiles'}
                  </span>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm ${
                    i === activeIndex ? 'bg-brand-bg-alt' : 'hover:bg-brand-bg-alt'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(item)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {avatar ? <MemberAvatar url={avatar} /> : null}
                  <span className="truncate">{label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
})

function resolveSlotDisplayName(
  name: string,
  profileId: string | null,
  padelPlayerId: string | null,
  profile: Profile | null | undefined,
  player: PadelPlayerOption | null | undefined,
): string {
  if (profileId && profile?.display_name?.trim()) {
    return clubDisplayName(profileId, profile.display_name)
  }
  if (padelPlayerId && player?.display_name?.trim()) {
    return player.display_name
  }
  return name
}

function commitSlotName(
  trimmed: string,
  showMembers: boolean,
  showPlayerProfiles: boolean,
  availableMembers: Profile[],
  availablePlayers: PadelPlayerOption[],
): { name: string; profileId: string | null; padelPlayerId: string | null } {
  if (!trimmed) {
    return { name: '', profileId: null, padelPlayerId: null }
  }
  const memberExact = showMembers
    ? availableMembers.find(
        (p) =>
          clubDisplayName(p.id, p.display_name).toLowerCase() === trimmed.toLowerCase() ||
          p.display_name.toLowerCase() === trimmed.toLowerCase(),
      )
    : null
  if (memberExact) {
    return { name: memberExact.display_name, profileId: memberExact.id, padelPlayerId: null }
  }
  const playerExact = showPlayerProfiles
    ? availablePlayers.find((p) => p.display_name.toLowerCase() === trimmed.toLowerCase())
    : null
  if (playerExact) {
    return { name: playerExact.display_name, profileId: null, padelPlayerId: playerExact.id }
  }
  return { name: trimmed, profileId: null, padelPlayerId: null }
}

function MemberSlotNameInput({
  name,
  profileId,
  padelPlayerId,
  profile,
  player,
  disabled,
  showMembers,
  showPlayerProfiles,
  availableMembers,
  availablePlayers,
  onPick,
}: {
  name: string
  profileId: string | null
  padelPlayerId: string | null
  profile: Profile | null | undefined
  player: PadelPlayerOption | null | undefined
  disabled?: boolean
  showMembers: boolean
  showPlayerProfiles: boolean
  availableMembers: Profile[]
  availablePlayers: PadelPlayerOption[]
  onPick: (name: string, profileId: string | null, padelPlayerId: string | null) => void
}) {
  const resolved = resolveSlotDisplayName(name, profileId, padelPlayerId, profile, player)
  const [text, setText] = useState(resolved)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(resolved)
  }, [resolved, editing])

  return (
    <input
      type="text"
      value={text}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onFocus={() => setEditing(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setEditing(false)
        const next = commitSlotName(
          text.trim(),
          showMembers,
          showPlayerProfiles,
          availableMembers,
          availablePlayers,
        )
        setText(
          resolveSlotDisplayName(
            next.name,
            next.profileId,
            next.padelPlayerId,
            next.profileId ? availableMembers.find((p) => p.id === next.profileId) : null,
            next.padelPlayerId ? availablePlayers.find((p) => p.id === next.padelPlayerId) : null,
          ),
        )
        onPick(next.name, next.profileId, next.padelPlayerId)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className="brand-input h-9 min-w-0 flex-1 py-1 text-sm"
      autoComplete="name"
    />
  )
}

export function MemberPlayerSlots({
  count,
  profiles,
  padelPlayers = [],
  names,
  profileIds,
  padelPlayerIds,
  onChange,
  onAdd,
  canAdd = false,
  addLabel = 'Add player',
  disabled,
  showMembers = false,
  showPlayerProfiles = true,
  nameInputMode = 'picker',
  linkAvatarsToProfile = false,
  competitionId = null,
}: Props) {
  const paddedNames = pad(names, count, '')
  const paddedIds = pad(profileIds, count, null)
  const paddedPadelIds = pad(padelPlayerIds ?? [], count, null)
  const canPick =
    nameInputMode === 'picker' && (showMembers || (showPlayerProfiles && padelPlayers.length > 0))

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const playerById = useMemo(
    () => new Map(padelPlayers.map((p) => [p.id, p])),
    [padelPlayers],
  )

  const guestPlayers = useMemo(
    () => padelPlayers.filter((p) => !p.profile_id),
    [padelPlayers],
  )

  const availableMembersBySlot = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const taken = new Set(
          paddedIds.filter((id, i) => i !== index && id).map((id) => id!),
        )
        const selectedId = paddedIds[index]
        const list = profiles.filter((p) => !taken.has(p.id))
        if (selectedId && !list.some((p) => p.id === selectedId)) {
          const selected = profileById.get(selectedId)
          if (selected) return [selected, ...list]
        }
        return list
      }),
    [count, paddedIds, profiles, profileById],
  )

  const availablePlayersBySlot = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const taken = new Set(
          paddedPadelIds.filter((id, i) => i !== index && id).map((id) => id!),
        )
        const selectedId = paddedPadelIds[index]
        const list = guestPlayers.filter((p) => !taken.has(p.id))
        if (selectedId && !list.some((p) => p.id === selectedId)) {
          const selected = playerById.get(selectedId)
          if (selected) return [selected, ...list]
        }
        return list
      }),
    [count, guestPlayers, paddedPadelIds, playerById],
  )

  const pick = (
    index: number,
    name: string,
    profileId: string | null,
    padelPlayerId: string | null,
  ) => {
    const nextNames = [...paddedNames]
    const nextIds = [...paddedIds]
    const nextPadelIds = [...paddedPadelIds]
    nextNames[index] = name
    nextIds[index] = profileId
    nextPadelIds[index] = padelPlayerId
    onChange(nextNames, nextIds, nextPadelIds)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-2">
        {Array.from({ length: count }, (_, index) => {
          const profileId = paddedIds[index] ?? null
          const padelPlayerId = paddedPadelIds[index] ?? null
          const selectedProfile = profileId ? profileById.get(profileId) : null
          const selectedPlayer = padelPlayerId ? playerById.get(padelPlayerId) : null
          const slotName = paddedNames[index] ?? ''
          const displayName = resolveSlotDisplayName(
            slotName,
            profileId,
            padelPlayerId,
            selectedProfile,
            selectedPlayer,
          )
          return (
          <div key={index} className="flex min-w-0 items-center gap-2">
            <span className="w-5 shrink-0 text-center text-[10px] tabular-nums text-brand-muted">
              {index + 1}
            </span>
            {linkAvatarsToProfile ? (
              <PlayerAvatarLink
                displayName={displayName}
                avatarUrl={selectedProfile?.avatar_url ?? null}
                profileId={profileId}
                padelPlayerId={padelPlayerId}
                competitionId={competitionId}
                imgClassName="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-brand-border/80"
              />
            ) : (
              <SlotAvatar url={selectedProfile?.avatar_url ?? null} name={displayName} />
            )}
            {canPick ? (
              <PlayerSlotCombobox
                availableMembers={availableMembersBySlot[index] ?? []}
                availablePlayers={availablePlayersBySlot[index] ?? []}
                value={slotName}
                disabled={disabled}
                showMembers={showMembers}
                showPlayerProfiles={showPlayerProfiles}
                onPick={(name, nextProfileId, nextPadelPlayerId) =>
                  pick(index, name, nextProfileId, nextPadelPlayerId)
                }
              />
            ) : (
              <MemberSlotNameInput
                name={slotName}
                profileId={profileId}
                padelPlayerId={padelPlayerId}
                profile={selectedProfile}
                player={padelPlayerId ? playerById.get(padelPlayerId) : null}
                disabled={disabled}
                showMembers={showMembers}
                showPlayerProfiles={showPlayerProfiles}
                availableMembers={availableMembersBySlot[index] ?? []}
                availablePlayers={availablePlayersBySlot[index] ?? []}
                onPick={(name, nextProfileId, nextPadelPlayerId) =>
                  pick(index, name, nextProfileId, nextPadelPlayerId)
                }
              />
            )}
            <span className="sr-only">Player {index + 1}</span>
          </div>
          )
        })}
      </div>
      {canAdd && onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="flex items-center gap-1.5 text-sm font-medium text-brand-accent disabled:opacity-40"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-accent text-base leading-none">
            +
          </span>
          {addLabel}
        </button>
      ) : null}
    </div>
  )
}
