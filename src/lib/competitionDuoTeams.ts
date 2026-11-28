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

type SetupRosterPlayer = {
  id: string
  rank: number
  name: string
  profileId: string | null
  padelPlayerId: string | null
}

/** Restore saved sides without changing the roster ranks used by an existing draw. */
export function hydrateDuoTeams(
  roster: SetupRosterPlayer[],
  pairs: Array<SessionPairRef & { pair_label?: string | null }>,
  teamCount: number,
): { teams: DuoTeamDraft[]; ranks: Array<number | null> } | null {
  const byId = new Map(roster.map((player) => [player.id, player]))
  const teams = emptyDuoTeams(teamCount)
  const ranks = Array<number | null>(teamCount * 2).fill(null)
  const placed = new Set<string>()
  const occupied = new Set<number>()
  const savedRank = (pair: SessionPairRef) =>
    byId.get(pair.roster_a_id ?? '')?.rank ?? byId.get(pair.roster_b_id ?? '')?.rank ?? Number.MAX_SAFE_INTEGER

  for (const pair of [...pairs].sort((a, b) => savedRank(a) - savedRank(b))) {
    if (!pair.roster_a_id && !pair.roster_b_id) continue
    const a = pair.roster_a_id ? byId.get(pair.roster_a_id) : undefined
    const b = pair.roster_b_id ? byId.get(pair.roster_b_id) : undefined
    if ((pair.roster_a_id && !a) || (pair.roster_b_id && !b) || (a && b && a.id === b.id)) return null
    if ((a && placed.has(a.id)) || (b && placed.has(b.id))) return null

    const preferred = Math.floor(savedRank(pair) / 2)
    const index = teams[preferred] && !occupied.has(preferred)
      ? preferred
      : teams.findIndex((_, candidate) => !occupied.has(candidate))
    if (index === -1) return null
    occupied.add(index)
    teams[index] = {
      label: pair.pair_label ?? '',
      names: [a?.name ?? '', b?.name ?? ''],
      profileIds: [a?.profileId ?? null, b?.profileId ?? null],
      padelPlayerIds: [a?.padelPlayerId ?? null, b?.padelPlayerId ?? null],
    }
    ranks[index * 2] = a?.rank ?? null
    ranks[index * 2 + 1] = b?.rank ?? null
    if (a) placed.add(a.id)
    if (b) placed.add(b.id)
  }

  return placed.size === roster.length ? { teams, ranks } : null
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
