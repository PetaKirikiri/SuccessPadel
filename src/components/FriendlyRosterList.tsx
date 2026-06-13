import { useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { firstDisplayName } from '../lib/leaderboardEntries'
import type { FriendlyRosterSlot } from '../lib/friendlyGameDisplay'
import { PlayerNameLink } from './PlayerNameLink'

type Props = {
  slots: FriendlyRosterSlot[]
  currentUserId?: string | null
  competitionId?: string | null
}

function RosterAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [broken, setBroken] = useState(false)
  const initial = firstDisplayName(name || 'Player')[0]?.toUpperCase() ?? '?'

  if (avatarUrl && !broken) {
    return (
      <img
        src={avatarUrl}
        alt=""
        onError={() => setBroken(true)}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    )
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-[11px] font-semibold text-brand-primary">
      {initial}
    </span>
  )
}

export function FriendlyRosterList({ slots, currentUserId, competitionId }: Props) {
  const { t } = useTranslation()

  return (
    <ul className="m-0 flex w-full min-w-0 max-w-full list-none flex-wrap gap-1.5 p-0">
      {slots.map((slot, i) => {
        const isMe = Boolean(currentUserId && slot.profileId === currentUserId)
        if (slot.vacant) {
          return (
            <li
              key={`open-${i}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-brand-primary/25 bg-brand-bg-alt py-1 pl-1 pr-2.5 text-brand-muted"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                +
              </span>
              <span className="text-xs font-medium">{t('friendly.openSpots')}</span>
            </li>
          )
        }

        const name = firstDisplayName(slot.name || 'Player')
        return (
          <li
            key={`${slot.profileId ?? slot.padelPlayerId ?? slot.name}-${i}`}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 ${
              isMe
                ? 'border-brand-accent/50 bg-brand-accent/10'
                : 'border-brand-primary/20 bg-brand-bg-alt'
            }`}
          >
            <RosterAvatar name={slot.name} avatarUrl={slot.avatarUrl ?? null} />
            <PlayerNameLink
              displayName={name}
              profileId={slot.profileId}
              padelPlayerId={slot.padelPlayerId}
              competitionId={competitionId}
              className={`truncate text-xs font-semibold ${
                isMe ? 'text-brand-accent' : 'text-brand-primary'
              }`}
            />
          </li>
        )
      })}
    </ul>
  )
}
