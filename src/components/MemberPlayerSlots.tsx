import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Profile } from '../lib/types'

type Props = {
  count: number
  profiles: Profile[]
  names: string[]
  profileIds: (string | null)[]
  onChange: (names: string[], profileIds: (string | null)[]) => void
  onAdd?: () => void
  canAdd?: boolean
  addLabel?: string
  disabled?: boolean
}

function pad<T>(values: T[], count: number, fill: T): T[] {
  const next = values.slice(0, count)
  while (next.length < count) next.push(fill)
  return next
}

function filterMembers(profiles: Profile[], query: string): Profile[] {
  const q = query.trim().toLowerCase()
  if (!q) return profiles
  return profiles.filter((p) => p.display_name.toLowerCase().includes(q))
}

function MemberAvatar({ url, size = 'md' }: { url: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
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

const MemberSlotInput = memo(function MemberSlotInput({
  index,
  availableProfiles,
  profileById,
  value,
  selectedId,
  disabled,
  onPick,
}: {
  index: number
  availableProfiles: Profile[]
  profileById: Map<string, Profile>
  value: string
  selectedId: string | null
  disabled?: boolean
  onPick: (name: string, id: string | null) => void
}) {
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    setText(value)
  }, [value])

  const selectedProfile = selectedId ? profileById.get(selectedId) : null

  const suggestions = useMemo(() => filterMembers(availableProfiles, text), [availableProfiles, text])

  useEffect(() => {
    if (!open) setActiveIndex(-1)
    else if (suggestions.length > 0) setActiveIndex(0)
  }, [open, suggestions.length])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const commit = (nextText: string) => {
    const trimmed = nextText.trim()
    const exact = availableProfiles.find(
      (p) => p.display_name.toLowerCase() === trimmed.toLowerCase(),
    )
    onPick(exact?.display_name ?? trimmed, exact?.id ?? null)
  }

  const selectAt = (idx: number) => {
    const p = suggestions[idx]
    if (!p) return
    onPick(p.display_name, p.id)
    setText(p.display_name)
    setOpen(false)
  }

  const avatarUrl = selectedProfile?.avatar_url ?? null

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        value={text}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={`member-slot-list-${index}`}
        aria-autocomplete="list"
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
        className={`brand-input w-full py-1 text-sm ${avatarUrl ? 'pl-8' : ''}`}
        placeholder="Name"
        autoComplete="off"
      />
      {avatarUrl ? (
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2">
          <MemberAvatar size="sm" url={avatarUrl} />
        </span>
      ) : null}
      {open && suggestions.length > 0 ? (
        <ul
          id={`member-slot-list-${index}`}
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-0.5 max-h-52 overflow-y-auto overscroll-contain rounded-lg border border-brand-border bg-brand-surface py-0.5 shadow-md"
        >
          {suggestions.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm ${
                  i === activeIndex ? 'bg-brand-bg-alt' : 'hover:bg-brand-bg-alt'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectAt(i)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {p.avatar_url ? <MemberAvatar url={p.avatar_url} /> : null}
                <span className="truncate">{p.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <span className="sr-only">Player {index + 1}</span>
    </div>
  )
})

export function MemberPlayerSlots({
  count,
  profiles,
  names,
  profileIds,
  onChange,
  onAdd,
  canAdd = false,
  addLabel = 'Add player',
  disabled,
}: Props) {
  const paddedNames = pad(names, count, '')
  const paddedIds = pad(profileIds, count, null)

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])

  const availableBySlot = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const taken = new Set(
          paddedIds.filter((id, i) => i !== index && id).map((id) => id!),
        )
        return profiles.filter((p) => !taken.has(p.id))
      }),
    [count, paddedIds, profiles],
  )

  const pick = (index: number, name: string, id: string | null) => {
    const nextNames = [...paddedNames]
    const nextIds = [...paddedIds]
    nextNames[index] = name
    nextIds[index] = id
    onChange(nextNames, nextIds)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex min-w-0 items-center gap-1">
            <span className="w-4 shrink-0 text-[10px] tabular-nums text-brand-muted">
              {index + 1}
            </span>
            <MemberSlotInput
              index={index}
              availableProfiles={availableBySlot[index] ?? []}
              profileById={profileById}
              value={paddedNames[index] ?? ''}
              selectedId={paddedIds[index] ?? null}
              disabled={disabled}
              onPick={(name, id) => pick(index, name, id)}
            />
          </div>
        ))}
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
