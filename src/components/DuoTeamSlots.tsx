import { useMemo } from 'react'
import { MemberPlayerSlots, type PadelPlayerOption } from './MemberPlayerSlots'
import type { Profile } from '../lib/types'
import type { DuoTeamDraft } from '../lib/competitionDuoTeams'

type Props = {
  teams: DuoTeamDraft[]
  profiles: Profile[]
  padelPlayers?: PadelPlayerOption[]
  onChange: (teams: DuoTeamDraft[]) => void
  disabled?: boolean
  layout?: 'stack' | 'grid'
}

export function DuoTeamSlots({
  teams,
  profiles,
  padelPlayers,
  onChange,
  disabled,
  layout = 'stack',
}: Props) {
  const slotNames = useMemo(
    () => teams.flatMap((team) => team.names),
    [teams],
  )
  const slotProfileIds = useMemo(
    () => teams.flatMap((team) => team.profileIds),
    [teams],
  )
  const slotPadelIds = useMemo(
    () => teams.flatMap((team) => team.padelPlayerIds),
    [teams],
  )

  const handleSlotChange = (
    names: string[],
    profileIds: (string | null)[],
    padelPlayerIds: (string | null)[],
  ) => {
    const next = teams.map((team, teamIndex) => {
      const base = teamIndex * 2
      return {
        ...team,
        names: [names[base] ?? '', names[base + 1] ?? ''] as [string, string],
        profileIds: [profileIds[base] ?? null, profileIds[base + 1] ?? null] as [
          string | null,
          string | null,
        ],
        padelPlayerIds: [
          padelPlayerIds[base] ?? null,
          padelPlayerIds[base + 1] ?? null,
        ] as [string | null, string | null],
      }
    })
    onChange(next)
  }

  return (
    <div className={layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-4'}>
      {teams.map((team, teamIndex) => (
        <div
          key={teamIndex}
          className={`rounded-xl border bg-brand-bg-alt/40 p-3 ${
            layout === 'grid' ? 'border-brand-primary/15 p-2' : 'border-brand-border/50'
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            {layout === 'stack' ? (
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-brand-muted">
                Team {teamIndex + 1}
              </span>
            ) : null}
            <input
              type="text"
              value={team.label}
              disabled={disabled}
              placeholder={`Team ${teamIndex + 1}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                const next = [...teams]
                next[teamIndex] = { ...team, label: e.target.value }
                onChange(next)
              }}
              className={`brand-input min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide ${
                layout === 'grid' ? 'h-8 px-2' : 'h-9 text-sm'
              }`}
            />
          </div>
          <MemberPlayerSlots
            count={2}
            profiles={profiles}
            padelPlayers={padelPlayers}
            names={team.names}
            profileIds={team.profileIds}
            padelPlayerIds={team.padelPlayerIds}
            onChange={(names, profileIds, padelPlayerIds) => {
              const flatNames = [...slotNames]
              const flatProfiles = [...slotProfileIds]
              const flatPadel = [...slotPadelIds]
              const base = teamIndex * 2
              flatNames[base] = names[0] ?? ''
              flatNames[base + 1] = names[1] ?? ''
              flatProfiles[base] = profileIds[0] ?? null
              flatProfiles[base + 1] = profileIds[1] ?? null
              flatPadel[base] = padelPlayerIds[0] ?? null
              flatPadel[base + 1] = padelPlayerIds[1] ?? null
              handleSlotChange(flatNames, flatProfiles, flatPadel)
            }}
            disabled={disabled}
            showMembers
            showPlayerProfiles
          />
        </div>
      ))}
    </div>
  )
}

export type { DuoTeamDraft } from '../lib/competitionDuoTeams'
export {
  duoTeamsComplete,
  duoTeamsToPairPayload,
  duoTeamsToPairSlotPayload,
  duoTeamsToRosterSlots,
  duoTeamsToScheduleInput,
  emptyDuoTeams,
  filledDuoPlayerCount,
} from '../lib/competitionDuoTeams'
