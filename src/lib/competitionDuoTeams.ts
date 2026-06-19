export type DuoTeamDraft = {
  label: string
  names: [string, string]
  profileIds: [string | null, string | null]
  padelPlayerIds: [string | null, string | null]
}

function emptyTeam(): DuoTeamDraft {
  return {
    label: '',
    names: ['', ''],
    profileIds: [null, null],
    padelPlayerIds: [null, null],
  }
}

export function emptyDuoTeams(count = 6): DuoTeamDraft[] {
  return Array.from({ length: count }, () => emptyTeam())
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
