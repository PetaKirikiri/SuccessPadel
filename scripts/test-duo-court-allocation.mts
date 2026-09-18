import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { buildDuoStoredSchedule, duoRoundRobinRounds } from '../src/lib/duoRoundRobinSchedule'

const started = performance.now()
for (const teamCount of [2, 4, 6, 8]) {
  for (const gameCount of [1, 4, 6, 7, 20]) {
    const teams = Array.from({ length: teamCount }, (_, slot) => ({
      label: `Team ${slot + 1}`,
      rosterIds: [`${slot}-a`, `${slot}-b`] as [string, string],
    }))
    const before = structuredClone(teams)
    const schedule = buildDuoStoredSchedule(teams, gameCount, 42)
    const originalRounds = duoRoundRobinRounds(teamCount)
    assert.equal(schedule.length, gameCount)
    schedule.forEach((round, index) => {
      assert.equal(round.round, index + 1)
      assert.deepEqual(round.matches.map(match => match.court).sort((a, b) => a - b),
        Array.from({ length: teamCount / 2 }, (_, court) => court + 1))
      if (index < originalRounds.length) {
        assert.deepEqual(round.matches.map(match => [match.team_a, match.team_b]),
          originalRounds[index].map(([a, b]) => [teams[a].rosterIds, teams[b].rosterIds]))
      }
    })
    assert.deepEqual(teams, before)
    assert.deepEqual(buildDuoStoredSchedule(teams, gameCount, 42), schedule)
    if (teamCount === 8 && [6, 7].includes(gameCount)) {
      const distribution = teams.map(team => {
        const courts = schedule.map(round => round.matches.find(match =>
          match.team_a[0] === team.rosterIds[0] || match.team_b[0] === team.rosterIds[0])!.court)
        const counts = [1, 2, 3, 4].map(court => courts.filter(value => value === court).length)
        assert.ok(counts.every(count => count >= 1 && count <= 2), JSON.stringify({ gameCount, courts, counts }))
        return courts
      })
      console.log(`${gameCount} games:`, JSON.stringify(distribution))
      // Empty and duplicate display names/roster placeholders must not change slot allocation.
      const empty = buildDuoStoredSchedule(teams.map(() => ({ label: '', rosterIds: ['', ''] })), gameCount, 42)
      assert.deepEqual(empty.map(round => round.matches.map(match => match.court)),
        schedule.map(round => round.matches.map(match => match.court)))
    }
  }
}
console.log(`Duo court allocation passed (${Math.round(performance.now() - started)} ms including repeated/20-game draws)`)
