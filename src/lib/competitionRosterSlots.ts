export type CompetitionRosterSlotPayload = {
  name: string
  profile_id: string | null
  padel_player_id: string | null
}

export function buildCompetitionRosterSlots(
  names: string[],
  profileIds: (string | null)[],
  padelPlayerIds: (string | null)[],
): CompetitionRosterSlotPayload[] {
  const len = Math.max(names.length, profileIds.length, padelPlayerIds.length)
  return Array.from({ length: len }, (_, i) => ({
    name: (names[i] ?? '').trim(),
    profile_id: profileIds[i] ?? null,
    padel_player_id: padelPlayerIds[i] ?? null,
  }))
}
