import { useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { firstDisplayName } from '../lib/leaderboardEntries'
import type { CompetitionTeamSlot } from '../lib/competitionGameDisplay'
import type { RosterSlot } from '../lib/friendlyGameDisplay'
import { PlayerNameLink } from './PlayerNameLink'

type Props = {
  teams: CompetitionTeamSlot[]
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
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-brand-primary/25 bg-brand-bg-alt py-1 pl-1 pr-2.5 text-brand-muted">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          +
        </span>
        <span className="text-xs font-medium">{t('friendly.openSpots')}</span>
      </span>
    )
  }

  const name = firstDisplayName(slot.name || 'Player')
  return (
    <span
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
    </span>
  )
}

export function DuoTeamRosterList({ teams, currentUserId, competitionId }: Props) {
  return (
    <ul className="m-0 grid w-full min-w-0 max-w-full list-none grid-cols-2 gap-2 p-0">
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
