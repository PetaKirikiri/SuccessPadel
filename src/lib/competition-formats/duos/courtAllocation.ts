function permutations(values: number[]): number[][] {
  if (values.length <= 1) return [values]
  return values.flatMap((value, index) =>
    permutations(values.filter((_, other) => index !== other)).map(rest => [value, ...rest]),
  )
}

/** Assign courts to fixed match-ups. Team slot indices also work for unfilled slots. */
export function allocateDuoCourts(rounds: number[][][], teamCount: number): number[][] {
  const courtCount = teamCount / 2
  if (!rounds.length || courtCount < 1) return []
  const courts = Array.from({ length: courtCount }, (_, index) => index + 1)
  // The club has four courts. Keep larger imports bounded rather than generating n! choices.
  const choices = courtCount <= 4 ? permutations(courts) : courts.map((_, shift) =>
    courts.map((__, index) => courts[(index + shift) % courtCount]),
  )
  const uses = Array.from({ length: teamCount }, () => Array<number>(courtCount).fill(0))
  const previous = Array<number>(teamCount).fill(0)
  const allocation: number[][] = []
  const minimum = Math.floor(rounds.length / courtCount)
  const maximum = Math.ceil(rounds.length / courtCount)
  let budget = 5000

  const rankedChoices = (round: number[][]) => choices.map(order => ({
    order,
    repeats: round.reduce((sum, teams, match) => sum + teams.filter(team => previous[team] === order[match]).length, 0),
    visits: round.reduce((sum, teams, match) => sum + teams.reduce((n, team) => n + uses[team][order[match] - 1], 0), 0),
  })).sort((a, b) => a.repeats - b.repeats || a.visits - b.visits)

  const apply = (round: number[][], order: number[], delta: number) => {
    round.forEach((teams, match) => teams.forEach(team => {
      uses[team][order[match] - 1] += delta
      if (delta > 0) previous[team] = order[match]
    }))
  }

  const search = (index: number): boolean => {
    if (--budget < 0) return false
    if (index === rounds.length) return uses.every(team => team.every(count => count >= minimum))
    const remaining = rounds.length - index
    if (uses.some(team => team.reduce((sum, count) => sum + Math.max(0, minimum - count), 0) > remaining)) return false
    const round = rounds[index]
    // Court labels are symmetric initially; preserve the familiar first-game positions.
    const options = index === 0 ? [{ order: courts }] : rankedChoices(round)
    for (const { order } of options) {
      if (round.some((teams, match) => teams.some(team => uses[team][order[match] - 1] >= maximum))) continue
      const prior = previous.slice()
      apply(round, order, 1)
      allocation.push(order)
      if (search(index + 1)) return true
      allocation.pop()
      apply(round, order, -1)
      previous.splice(0, previous.length, ...prior)
      if (budget < 0) break
    }
    return false
  }

  if (search(0)) return allocation

  // Unusual draws may not admit a perfectly even allocation. Prefer underused
  // courts, then avoid consecutive visits; never alter opponents to force a fit.
  return rounds.map(round => {
    const ranked = rankedChoices(round).sort((a, b) => a.visits - b.visits || a.repeats - b.repeats)
    const order = ranked[0].order
    apply(round, order, 1)
    return order
  })
}
