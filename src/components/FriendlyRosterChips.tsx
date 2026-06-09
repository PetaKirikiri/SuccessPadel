import { useTranslation } from '../hooks/useTranslation'
import { firstDisplayName } from '../lib/leaderboardEntries'
import type { FriendlyRosterSlot } from '../lib/friendlyGameDisplay'

function RosterChip({
  slot,
  isMe,
  openLabel,
}: {
  slot: FriendlyRosterSlot
  isMe: boolean
  openLabel: string
}) {
  if (slot.vacant) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-border/80 bg-brand-bg-alt/50 py-1 pl-1 pr-4 text-sm text-brand-muted">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-surface text-base font-semibold">
          +
        </span>
        <span className="font-semibold">{openLabel}</span>
      </span>
    )
  }

  const name = firstDisplayName(slot.name || 'Player')
  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-sm ${
        isMe
          ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-primary'
          : 'border-brand-border/70 bg-brand-surface text-brand-primary'
      }`}
    >
      {slot.avatarUrl ? (
        <img src={slot.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-base font-semibold">
          {name[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      <span className="truncate font-semibold">{name}</span>
    </span>
  )
}

type Props = {
  slots: FriendlyRosterSlot[]
  currentUserId?: string | null
}

export function FriendlyRosterChips({ slots, currentUserId }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot, i) => (
        <RosterChip
          key={`${slot.profileId ?? slot.name}-${i}`}
          slot={slot}
          isMe={Boolean(currentUserId && slot.profileId === currentUserId)}
          openLabel={t('friendly.openSpots')}
        />
      ))}
    </div>
  )
}
