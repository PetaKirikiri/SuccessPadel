type Player = { id: string }
type Pair = { roster_a_id?: string | null; roster_b_id?: string | null } | null | undefined

/** Pair records own membership; adjacent names are never guessed into a team. */
export function fixedPairRoster<T extends Player>(players: readonly T[], pairs: readonly Pair[]): { players: T[]; teams: [T, T][]; error: string | null } {
  const byId = new Map(players.map(player => [player.id, player]))
  const result: T[] = []
  const teams: [T, T][] = []
  for (const pair of pairs) {
    const a = pair?.roster_a_id ? byId.get(pair.roster_a_id) : undefined
    const b = pair?.roster_b_id ? byId.get(pair.roster_b_id) : undefined
    if (!a || !b || a.id === b.id) return { players: [], teams: [], error: 'Fixed-pair roster incomplete. Check team setup.' }
    result.push(a, b)
    teams.push([a, b])
  }
  if (result.length !== players.length || new Set(result.map(player => player.id)).size !== players.length) {
    return { players: [], teams: [], error: 'Fixed-pair roster incomplete. Check team setup.' }
  }
  return { players: result, teams, error: null }
}
