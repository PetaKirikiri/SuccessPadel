import assert from 'node:assert/strict'
import { test } from 'node:test'
import { arrivalTime, chooseAutomaticShot, calculateHeatmap, defensiveSafety, evaluateShot, initialTactics, movePlayer } from '../src/surfaces/tactics/tacticsModel.ts'

test('a defender on the trajectory closes an otherwise open shot', () => {
  const state = initialTactics()
  state.ball = { x: 1, y: 15 }
  state.target = { x: 1, y: 3 }
  state.players = state.players.map(p => p.team === 'opponents' ? { ...p, x: 9, y: 9 } : p)
  const open = evaluateShot(state)
  state.players[0] = { ...state.players[0], x: 1, y: 7 }
  const covered = evaluateShot(state)
  assert.ok(open.valid && covered.valid)
  assert.ok(open.margin > covered.margin + 0.5)
  assert.ok(open.score > covered.score + 30)
  assert.equal(covered.interceptor, 1)
})

test('a short fast trajectory into the net cannot be an open target', () => {
  const state = initialTactics()
  state.ball = { x: 5, y: 11 }; state.target = { x: 5, y: 9 }; state.speed = 20
  const shot = evaluateShot(state)
  assert.equal(shot.valid, false)
  assert.equal(shot.score, 0)
  assert.equal(shot.reason, 'net')
  assert.equal(shot.samples.at(-1)?.y, 10)
})

test('glass rebounds stay on court and run forward in time', () => {
  const state = initialTactics()
  state.ball = { x: 5, y: 15 }; state.target = { x: 5, y: 0.5 }
  const shot = evaluateShot(state)
  assert.ok(shot.valid)
  const rebound = shot.samples.filter(p => p.bounced)
  assert.ok(rebound.some((p, i) => i > 0 && p.y > rebound[i - 1].y))
  for (let i = 1; i < shot.samples.length; i++) {
    const p = shot.samples[i]
    assert.ok(p.t > shot.samples[i - 1].t)
    assert.ok(p.x >= 0 && p.x <= 10 && p.y >= 0 && p.y <= 20)
  }
})

test('moving players preserves the chosen ball start; opponents cannot cross the net', () => {
  const start = initialTactics()
  const moved = movePlayer(start, 3, { x: 4, y: 16.7 })
  assert.deepEqual(moved.ball, start.ball)
  assert.deepEqual(start.players[2], { id: 3, team: 'you', x: 3, y: 15.7 })
  assert.ok(movePlayer(start, 1, { x: -100, y: 99 }).players[0].y < 10)
  assert.ok(movePlayer(start, 1, { x: -100, y: 99 }).players[0].x > 0)
})

test('reach takes longer with distance; both heatmaps are finite and bounded', () => {
  assert.ok(arrivalTime({ x: 0, y: 0 }, { x: 5, y: 0 }) > arrivalTime({ x: 0, y: 0 }, { x: 1, y: 0 }))
  for (const kind of ['drive', 'lob'] as const) {
    const state = { ...initialTactics(), kind, speed: kind === 'drive' ? 12 : 7 }
    const cells = calculateHeatmap(state)
    assert.equal(cells.length, 1600)
    assert.ok(cells.every(p => Number.isFinite(p.score) && p.score >= 0 && p.score <= 100))
  }
})


test('automatic shot selects the highest rated legal cell without changing the start', () => {
  const state = initialTactics()
  const result = chooseAutomaticShot(state)
  assert.ok(result.shot.valid)
  assert.equal(result.shot.score, Math.max(...result.cells.filter(c => c.y < 10).map(c => c.score)))
  assert.deepEqual(result.state.ball, state.ball)
  assert.deepEqual(result.shot.samples[0].x, state.ball.x)
  assert.deepEqual(result.shot.samples[0].y, state.ball.y)
  const moved = movePlayer(state, 1, result.state.target)
  moved.players[1] = { ...moved.players[1], x: result.state.target.x, y: Math.min(9.6, result.state.target.y + 1) }
  const next = chooseAutomaticShot(moved)
  assert.notDeepEqual(next.state.target, result.state.target)
})

test('starting on the other side mirrors the recommendation and heatmap', () => {
  const state = initialTactics()
  const normal = chooseAutomaticShot(state)
  const reverse = { ...state, ball: { x: 10 - state.ball.x, y: 20 - state.ball.y }, players: state.players.map(p => ({ ...p, x: 10 - p.x, y: 20 - p.y, team: p.team === 'you' ? 'opponents' as const : 'you' as const })) }
  const result = chooseAutomaticShot(reverse)
  assert.ok(Math.abs(result.shot.score - normal.shot.score) < 1e-8)
  assert.deepEqual(result.state.target, { x: 10 - normal.state.target.x, y: 20 - normal.state.target.y })
  assert.equal(result.cells.filter(c => c.y > 10).length, 1600)
  assert.equal(result.cells.filter(c => c.y < 10).length, 1600)
  for (let i = 0; i < result.cells.length; i++) {
    assert.ok(Math.abs(result.cells[i].score - normal.cells[i].score) < 1e-8)
    assert.equal(result.cells[i].y, 20 - normal.cells[i].y)
  }
  assert.deepEqual(result.state.ball, reverse.ball)
})

test('moving our partner updates defensive safety while preserving the ball and attack', () => {
  const state = initialTactics()
  const before = chooseAutomaticShot(state)
  const after = chooseAutomaticShot(movePlayer(state, 4, { x: 1, y: 11 }))
  assert.deepEqual(after.state.ball, before.state.ball)
  assert.deepEqual(after.state.target, before.state.target)
  const defense = after.cells.filter(c => c.y > 10)
  assert.equal(defense.length, 1600)
  assert.ok(defense.every(c => Number.isFinite(c.score) && c.score >= 0 && c.score <= 100))
  assert.ok(defense.some((c, i) => Math.abs(c.score - before.cells.filter(p => p.y > 10)[i].score) > 20))
})

test('uncovered short balls and the abandoned wing are dangerous, not safe wall recoveries', () => {
  const state = initialTactics()
  const returnArea = { x: 5.5, y: 5 }
  assert.ok(defensiveSafety(state, returnArea, { x: 5, y: 11 }) < 20)
  assert.ok(defensiveSafety(state, returnArea, { x: 7.3, y: 13.9 }) > 65)
  const shifted = movePlayer(state, 4, { x: 1, y: 15 })
  assert.ok(defensiveSafety(shifted, returnArea, { x: 8.5, y: 15 }) < 15)
  const covering = movePlayer(state, 4, { x: 5, y: 11 })
  assert.ok(defensiveSafety(covering, returnArea, { x: 5, y: 11 }) > defensiveSafety(state, returnArea, { x: 5, y: 11 }) + 30)
})
