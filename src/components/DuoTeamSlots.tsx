import { useMemo } from 'react'
import { MemberPlayerSlots, type PadelPlayerOption } from './MemberPlayerSlots'
import type { Profile } from '../lib/types'
import { DUO_TEAM_COUNT } from '../lib/competitionFormatPresets'

export type DuoTeamDraft = {
  label: string
  names: [string, string]
  profileIds: [string | null, string | null]
  padelPlayerIds: [string | null, string | null]
}

type Props = {
  teams: DuoTeamDraft[]
  profiles: Profile[]
  padelPlayers?: PadelPlayerOption[]
  onChange: (teams: DuoTeamDraft[]) => void
  disabled?: boolean
}

function emptyTeam(): DuoTeamDraft {
  return {
    label: '',
    names: ['', ''],
    profileIds: [null, null],
    padelPlayerIds: [null, null],
  }
}

export function emptyDuoTeams(count = DUO_TEAM_COUNT): DuoTeamDraft[] {
  return Array.from({ length: count }, () => emptyTeam())
}

export function DuoTeamSlots({
  teams,
  profiles,
  padelPlayers,
  onChange,
  disabled,
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
    <div className="space-y-4">
      {teams.map((team, teamIndex) => (
        <div key={teamIndex} className="rounded-xl border border-brand-border/50 bg-brand-bg-alt/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-brand-muted">
              Team {teamIndex + 1}
            </span>
            <input
              type="text"
              value={team.label}
              disabled={disabled}
              placeholder={`Team ${teamIndex + 1}`}
              onChange={(e) => {
                const next = [...teams]
                next[teamIndex] = { ...team, label: e.target.value }
                onChange(next)
              }}
              className="brand-input h-9 min-w-0 flex-1 text-sm"
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

export function duoTeamsToRosterSlots(teams: DuoTeamDraft[]) {
  return teams.flatMap((team) =>
    [0, 1].map((side) => ({
      name: team.names[side].trim(),
      profile_id: team.profileIds[side],
      padel_player_id: team.padelPlayerIds[side],
    })),
  )
}

export function duoTeamsToPairSlotPayload(
  teams: DuoTeamDraft[],
): Array<{ label: string; slot_a: number; slot_b: number }> {
  return teams.flatMap((team, index) => {
    if (!team.names[0]?.trim() || !team.names[1]?.trim()) return []
    return [
      {
        label: team.label.trim() || `Team ${index + 1}`,
        slot_a: index * 2,
        slot_b: index * 2 + 1,
      },
    ]
  })
}

export function duoTeamsToPairPayload(
  teams: DuoTeamDraft[],
  rosterIds: string[],
): Array<{ label: string; roster_a_id: string; roster_b_id: string }> {
  return teams.flatMap((team, index) => {
    const rosterA = rosterIds[index * 2]
    const rosterB = rosterIds[index * 2 + 1]
    if (!rosterA || !rosterB) return []
    return [
      {
        label: team.label.trim() || `Team ${index + 1}`,
        roster_a_id: rosterA,
        roster_b_id: rosterB,
      },
    ]
  })
}

export function duoTeamsToScheduleInput(
  teams: DuoTeamDraft[],
  rosterIds: string[],
): Array<{ label: string; rosterIds: [string, string] }> {
  return teams.flatMap((team, index) => {
    const rosterA = rosterIds[index * 2]
    const rosterB = rosterIds[index * 2 + 1]
    if (!rosterA || !rosterB) return []
    return [
      {
        label: team.label.trim() || `Team ${index + 1}`,
        rosterIds: [rosterA, rosterB] as [string, string],
      },
    ]
  })
}

export function filledDuoPlayerCount(teams: DuoTeamDraft[]): number {
  return teams.reduce(
    (sum, team) => sum + team.names.filter((name) => name.trim()).length,
    0,
  )
}

export function duoTeamsComplete(teams: DuoTeamDraft[]): boolean {
  return teams.every((team) => team.names[0].trim() && team.names[1].trim())
}
