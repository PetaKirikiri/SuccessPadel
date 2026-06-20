import { useTranslation } from '../hooks/useTranslation'
import { firstDisplayName } from '../lib/leaderboardEntries'
import type { RosterSlot } from '../lib/friendlyGameDisplay'
import { PlayerAvatarLink } from './PlayerAvatarLink'
import { PlayerNameLink } from './PlayerNameLink'

type Props = {
  slots: RosterSlot[]
  currentUserId?: string | null
  competitionId?: string | null
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
            <PlayerAvatarLink
              displayName={slot.name}
              avatarUrl={slot.avatarUrl}
              profileId={slot.profileId}
              padelPlayerId={slot.padelPlayerId}
              competitionId={competitionId}
            />
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
