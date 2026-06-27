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
    <ul className="m-0 flex w-full min-w-0 max-w-full list-none flex-wrap gap-2 p-0">
      {slots.map((slot, i) => {
        const isMe = Boolean(currentUserId && slot.profileId === currentUserId)
        if (slot.vacant) {
          return (
            <li
              key={`open-${i}`}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-dashed border-brand-primary/25 bg-brand-bg-alt py-1.5 pl-1.5 pr-3 text-brand-muted"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-semibold">
                +
              </span>
              <span className="text-sm font-semibold">{t('friendly.openSpots')}</span>
            </li>
          )
        }

        const name = firstDisplayName(slot.name || 'Player')
        return (
          <li
            key={`${slot.profileId ?? slot.padelPlayerId ?? slot.name}-${i}`}
            className={`inline-flex max-w-full items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 ${
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
              imgClassName="h-9 w-9 shrink-0 rounded-full object-cover"
            />
            <PlayerNameLink
              displayName={name}
              profileId={slot.profileId}
              padelPlayerId={slot.padelPlayerId}
              competitionId={competitionId}
              className={`whitespace-nowrap text-sm font-bold sm:text-base ${
                isMe ? 'text-brand-accent' : 'text-brand-primary'
              }`}
            />
          </li>
        )
      })}
    </ul>
  )
}
