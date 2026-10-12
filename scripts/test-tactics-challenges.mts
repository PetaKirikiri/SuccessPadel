import assert from 'node:assert/strict'
import { challenges, challengeState, scorePlacement } from '../src/surfaces/tactics/tacticsChallenges'
import { evaluateShot } from '../src/surfaces/tactics/tacticsModel'

for (const mode of ['positioning', 'placement'] as const) {
  const ids = new Set<string>()
  for (const c of challenges[mode]) {
    assert(!ids.has(c.id)); ids.add(c.id)
    const centre = { x: (c.area.left + c.area.right) / 2, y: (c.area.top + c.area.bottom) / 2 }
    assert.equal(scorePlacement(centre, c.area).score, 100)
    assert.equal(scorePlacement({ x: c.area.left, y: c.area.top }, c.area).score, 100)
    const near = scorePlacement({ x: c.area.right + 0.5, y: centre.y }, c.area)
    const far = scorePlacement({ x: c.area.right + 2, y: centre.y }, c.area)
    assert.equal(near.metres, 0.5)
    assert(near.score > far.score && near.score < 100 && far.score >= 0)
    const state = challengeState(c)
    state.players[0]!.x = 99
    assert.notEqual(c.state.players[0]!.x, 99, 'Attempts cannot mutate the scenario')
    if (mode === 'placement') {
      assert(c.area.bottom < 10)
      assert(evaluateShot({ ...challengeState(c), target: centre }).valid, `${c.id}: recommended zone must be playable`)
    } else {
      assert(c.area.top > 10)
      const player = c.state.players.find(p => p.id === c.player)!
      assert(scorePlacement(player, c.area).score < 100, 'Positioning starts outside the answer zone')
    }
  }
}
assert.equal(scorePlacement({ x: 0, y: 0 }, { left: 3, right: 4, top: 4, bottom: 5 }).metres, 5)
console.log('Challenge scoring: zone edges, distance falloff, diagonal distance, scenario isolation and playable shot targets passed.')
