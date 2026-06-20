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
  return teams.map((team, index) => ({
    label: team.label.trim() || `Team ${index + 1}`,
    slot_a: index * 2,
    slot_b: index * 2 + 1,
  }))
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

type SessionPairRef = {
  roster_a_id?: string | null
  roster_b_id?: string | null
}

/** Map session_pairs to team slots (0..teamCount-1) using roster rank_order. */
export function orderSessionPairsByTeamIndex<T extends SessionPairRef>(
  pairs: T[],
  rankByRosterId: Map<string, number>,
  teamCount: number,
): (T | undefined)[] {
  const ordered: (T | undefined)[] = Array.from({ length: teamCount })
  for (const pair of pairs) {
    const rankA = pair.roster_a_id ? rankByRosterId.get(pair.roster_a_id) : undefined
    const rankB = pair.roster_b_id ? rankByRosterId.get(pair.roster_b_id) : undefined
    const rank = rankA ?? rankB
    if (rank == null || rank < 0) continue
    const teamIndex = Math.floor(rank / 2)
    if (teamIndex >= 0 && teamIndex < teamCount) ordered[teamIndex] = pair
  }
  return ordered
}
