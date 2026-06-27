import { useTranslation } from '../hooks/useTranslation'
import { firstDisplayName } from '../lib/leaderboardEntries'
import type { CompetitionTeamSlot } from '../lib/competitionGameDisplay'
import type { RosterSlot } from '../lib/friendlyGameDisplay'
import { PlayerAvatarLink } from './PlayerAvatarLink'
import { PlayerNameLink } from './PlayerNameLink'

type Props = {
  teams: CompetitionTeamSlot[]
  currentUserId?: string | null
  competitionId?: string | null
}

function PlayerChip({
  slot,
  currentUserId,
  competitionId,
}: {
  slot: RosterSlot
  currentUserId?: string | null
  competitionId?: string | null
}) {
  const { t } = useTranslation()
  const isMe = Boolean(currentUserId && slot.profileId === currentUserId)

  if (slot.vacant) {
    return (
      <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-dashed border-brand-primary/25 bg-brand-bg-alt py-1.5 pl-1.5 pr-3 text-brand-muted">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-semibold">
          +
        </span>
        <span className="text-sm font-semibold">{t('friendly.openSpots')}</span>
      </span>
    )
  }

  const name = firstDisplayName(slot.name || 'Player')
  return (
    <span
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
    </span>
  )
}

export function DuoTeamRosterList({ teams, currentUserId, competitionId }: Props) {
  return (
    <ul className="m-0 grid w-full min-w-0 max-w-full list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
      {teams.map((team) => (
        <li
          key={team.pairId ?? `team-${team.teamIndex}`}
          className={`min-w-0 rounded-xl border px-2 py-2 ${
            team.vacant
              ? 'border-dashed border-brand-primary/25 bg-brand-bg-alt/40'
              : 'border-brand-primary/15 bg-brand-bg-alt/60'
          }`}
        >
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {team.label}
          </p>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {team.players.map((slot, side) => (
              <PlayerChip
                key={side}
                slot={slot}
                currentUserId={currentUserId}
                competitionId={competitionId}
              />
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
