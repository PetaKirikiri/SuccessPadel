import assert from 'node:assert/strict'
import { coverageShadows, playerShadow } from '../src/surfaces/tactics/coverageShadows.ts'
import { test } from 'node:test'
import { arrivalTime, backhandPressure, chooseAutomaticShot, calculateHeatmap, defensiveSafety, evaluateShot, executionMargin, initialTactics, lobOpportunity, movePlayer, selectShooter, possibleReturnContacts, returnFlight } from '../src/surfaces/tactics/tacticsModel.ts'

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

test('moving the shooter carries the ball; opponents cannot cross the net', () => {
  const start = initialTactics()
  const moved = movePlayer(start, 3, { x: 4, y: 16.7 })
  assert.notDeepEqual(moved.ball, start.ball)
  assert.equal(moved.ballOwner, 3)
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


test('automatic trajectory selects a forgiving direct shot without changing the start', () => {
  const state = initialTactics()
  const result = chooseAutomaticShot(state)
  assert.ok(result.shot.valid)
  assert.equal(result.state.kind, 'drive')
  assert.ok(executionMargin(result.state) > 0)
  assert.ok(Math.min(result.state.target.x, 10 - result.state.target.x, result.state.target.y, 10 - result.state.target.y) >= 1.25)
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

test('return danger follows reachable ball contacts instead of the opponents original positions', () => {
  // Preserve the regression's outgoing contact location independently of the default setup.
  const state = { ...movePlayer(initialTactics(), 3, { x: 3.55, y: 15.3 }), target: { x: 5.375, y: 4.875 }, speed: 16 }
  const outgoing = { shot: evaluateShot(state) }
  // Moving both opponents too far from this path must not invent a return.
  const unreachable = movePlayer(movePlayer(state, 1, { x: 0.35, y: 9.6 }), 2, { x: 9.65, y: 9.6 })
  assert.equal(possibleReturnContacts(unreachable, outgoing.shot).length, 0)
  const anticipatedRead = possibleReturnContacts(state, outgoing.shot)
  assert.ok(anticipatedRead.length > 0)
  assert.ok(defensiveSafety(state, anticipatedRead, { x: 7.3, y: 12 }) > 70)
  assert.ok(defensiveSafety(state, anticipatedRead, { x: 1, y: 12.5 }) < 25)
  assert.equal(defensiveSafety(state, [], { x: 5, y: 11 }), 50)
  // Give player 2 the anticipated central position, preserving the same shot.
  const anticipated = movePlayer(state, 2, { x: 4.8, y: 7.4 })
  const contacts = possibleReturnContacts(anticipated, outgoing.shot)
  assert.ok(contacts.length > 0)
  assert.ok(contacts.some(c => c.playerId === 2))
  assert.ok(contacts.every(c => outgoing.shot.samples.some(p => p.x === c.x && p.y === c.y && p.t === c.t)))
  assert.ok(defensiveSafety(anticipated, contacts, { x: 8.5, y: 15 }) > 80)
  assert.ok(defensiveSafety(anticipated, contacts, { x: 7.3, y: 12 }) > defensiveSafety(anticipated, contacts, { x: 1, y: 12.5 }) + 25)
  const abandoned = movePlayer(anticipated, 4, { x: 1, y: 15 })
  assert.ok(defensiveSafety(abandoned, contacts, { x: 8.5, y: 15 }) < defensiveSafety(anticipated, contacts, { x: 8.5, y: 15 }) - 30)
})

test('a low interception cannot produce an impossible fast short return through the net', () => {
  const state = initialTactics()
  const low = { x: 5, y: 7, z: 0.4, t: 0.5, bounced: false, playerId: 2, balance: 1 }
  const target = { x: 7.3, y: 12 }
  assert.equal(returnFlight(state, low, target, 1), null)
  const soft = returnFlight(state, low, target, 0.4)
  assert.ok(soft && soft.time > 0.7)
  const high = { ...low, z: 2.5 }
  assert.ok(returnFlight(state, high, target, 1))
  assert.ok(defensiveSafety(state, [low], target) > defensiveSafety(state, [high], target))
})

test('the trajectory restores its shooter anchor even if given a stale ball position', () => {
  const state = initialTactics()
  assert.equal(state.ballOwner, 3)
  const result = chooseAutomaticShot({ ...state, ball: { x: 9, y: 1 } })
  assert.deepEqual(result.state.ball, state.ball)
  assert.ok(result.shot.samples[0].y > 10)
})

test('useful lob zones appear behind net players and disappear when they cover the back', () => {
  const state = initialTactics()
  const lobCells = chooseAutomaticShot(state).cells.filter(p => (p.lobScore ?? 0) >= 65)
  assert.ok(lobCells.length > 0)
  assert.ok(lobCells.every(p => p.y <= 3.4 && p.y >= 0.6 && p.score >= 65))
  state.players = state.players.map(p => p.team === 'opponents' ? { ...p, y: 2 } : p)
  assert.equal(chooseAutomaticShot(state).cells.filter(p => (p.lobScore ?? 0) >= 65).length, 0)
  const low = { ...initialTactics(), kind: 'lob' as const, speed: 16, target: { x: 5, y: 2 } }
  assert.equal(lobOpportunity(low, evaluateShot(low), low.target), 0)
})


test('selecting a shooter moves the contact point and follows only that player', () => {
  const initial = initialTactics()
  assert.equal(selectShooter(initial, 99), initial)
  const selected = selectShooter(initial, 4)
  assert.equal(selected.hitter, 4)
  assert.equal(selected.ballOwner, 4)
  assert.deepEqual(selected.ball, { x: 7.3, y: 13.9 })
  const shot = chooseAutomaticShot(selected).shot
  assert.equal(shot.samples[0].x, selected.ball.x)
  assert.equal(shot.samples[0].y, selected.ball.y)
  assert.deepEqual(movePlayer(selected, 3, { x: 2, y: 18 }).ball, selected.ball)
  const moved = movePlayer(selected, 4, { x: 6, y: 17 })
  assert.notDeepEqual(moved.ball, selected.ball)
  assert.equal(selectShooter(moved, 3).ballOwner, 3)
})


test('either team can attack, with ball placement and lob zones following that side', () => {
  const initial = initialTactics()
  // Leave space behind the bottom team for a mirrored lob opportunity.
  const formation = movePlayer(movePlayer(initial, 3, { x: 3, y: 12.5 }), 4, { x: 7, y: 12.5 })
  const upper = selectShooter(formation, 1)
  assert.equal(upper.ballOwner, 1)
  assert.ok(upper.ball.y < 10)
  assert.deepEqual(upper.players, formation.players)
  const result = chooseAutomaticShot(upper)
  assert.ok(result.shot.valid && result.state.target.y > 10)
  assert.ok(Math.abs(result.shot.samples[0].y - upper.ball.y) < 1e-8)
  const lobs = result.cells.filter(c => (c.lobScore ?? 0) >= 65)
  assert.ok(lobs.length > 0 && lobs.every(c => c.y > 16.6))
  const moved = movePlayer(upper, 1, { x: 4, y: 2 })
  assert.deepEqual(moved.ball, { x: moved.players[0].x, y: moved.players[0].y })
  assert.notDeepEqual(moved.ball, upper.ball)
  const teammate = selectShooter(moved, 2)
  assert.equal(teammate.ballOwner, 2)
  assert.ok(teammate.ball.y < 10)
  const lower = selectShooter(teammate, 3)
  assert.equal(lower.ballOwner, 3)
  assert.ok(lower.ball.y > 10 && chooseAutomaticShot(lower).state.target.y < 10)
})


test('lob opportunities remain visible without becoming the direct trajectory on either side', () => {
  const initial = initialTactics()
  const states = [initial, selectShooter(movePlayer(movePlayer(initial, 3, { x: 3, y: 12.5 }), 4, { x: 7, y: 12.5 }), 1)]
  for (const state of states) {
    const result = chooseAutomaticShot(state)
    assert.equal(result.state.kind, 'drive')
    assert.ok(result.shot.valid)
    assert.ok(result.cells.some(c => (c.lobScore ?? 0) >= 65))
    assert.ok(result.cells.filter(c => (c.lobScore ?? 0) >= 65).every(c => c.score >= 65))
    assert.equal(result.state.target.y < 10, state.ball.y > 10)
  }
})


test('both shooting players clearly cover nearby space while the abandoned wing stays exposed', () => {
  const state = selectShooter(movePlayer(movePlayer(initialTactics(), 3, { x: 4.8, y: 12.7 }), 4, { x: 8.2, y: 12.9 }), 4)
  const contacts = [{ x: 2, y: 8, z: 2, t: 0.6, bounced: false, playerId: 1, balance: 1 }]
  for (const player of state.players.filter(p => p.team === 'you')) {
    assert.ok(defensiveSafety(state, contacts, player) >= 95)
    for (const [dx, dy] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]]) {
      assert.ok(defensiveSafety(state, contacts, { x: player.x + dx, y: player.y + dy }) > 85)
    }
  }
  const gap = { x: 1, y: 12.5 }
  assert.ok(defensiveSafety(state, contacts, gap) < 25)
  const covered = movePlayer(state, 3, gap)
  assert.ok(defensiveSafety(covered, contacts, gap) >= 95)
})


test('coverage shadows project away from the incoming ball and move with the player', () => {
  const player = { id: 4, team: 'you' as const, x: 7, y: 14 }
  const source = { x: 5, y: 6 }
  const shadow = playerShadow(player, source)
  assert.ok(shadow.polygon[1].y > player.y && shadow.polygon[2].y > player.y)
  for (const tangent of [shadow.polygon[0], shadow.polygon[3]]) {
    assert.ok(Math.abs(Math.hypot(tangent.x - player.x, tangent.y - player.y) - shadow.radius) < 1e-8)
    const dot = (tangent.x - player.x) * (tangent.x - source.x) + (tangent.y - player.y) * (tangent.y - source.y)
    assert.ok(Math.abs(dot) < 1e-8)
  }
  assert.notDeepEqual(playerShadow({ ...player, x: 3 }, source).polygon, shadow.polygon)
  const close = playerShadow(player, { x: 7, y: 13.5 })
  assert.ok(close.polygon.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))
})

test('each team projects behind its players and shadows mirror when the shooter changes ends', () => {
  const state = initialTactics(), result = chooseAutomaticShot(state)
  const shadows = coverageShadows(result.state, result.shot)
  assert.equal(shadows.length, 4)
  for (const shadow of shadows) {
    assert.ok(shadow.upper ? shadow.polygon[1].y < shadow.centre.y : shadow.polygon[1].y > shadow.centre.y)
  }
  const reflect = (p: { x: number; y: number }) => ({ x: 10 - p.x, y: 20 - p.y })
  const reversed = { ...state, ball: reflect(state.ball), players: state.players.map(p => ({ ...p, ...reflect(p), team: p.team === 'you' ? 'opponents' as const : 'you' as const })) }
  const other = chooseAutomaticShot(reversed)
  const mirrored = coverageShadows(other.state, other.shot)
  shadows.forEach((shadow, i) => shadow.polygon.forEach((point, j) => {
    assert.ok(Math.abs(mirrored[i].polygon[j].x - (10 - point.x)) < 1e-8)
    assert.ok(Math.abs(mirrored[i].polygon[j].y - (20 - point.y)) < 1e-8)
  }))
})

test('shot playback preserves pace, bounce timing and a pause between replays', async () => {
  const { sampleAtTime, playbackTime } = await import('../src/surfaces/tactics/shotPlayback.ts')
  const state = initialTactics()
  const slow = evaluateShot({ ...state, speed: 12 }, { x: 5, y: 2 })
  const fast = evaluateShot({ ...state, speed: 16 }, { x: 5, y: 2 })
  const slowPoint = sampleAtTime(slow, 0.3)!
  const fastPoint = sampleAtTime(fast, 0.3)!
  const travelled = (p: { x: number; y: number }) => Math.hypot(p.x - state.ball.x, p.y - state.ball.y)
  assert.ok(Math.abs(travelled(fastPoint) / travelled(slowPoint) - 16 / 12) < 1e-8)
  assert.deepEqual(sampleAtTime(fast, 0), { ...fast.samples[0] })
  const landing = sampleAtTime(fast, fast.flight)!
  assert.ok(Math.hypot(landing.x - 5, landing.y - 2) < 1e-8)
  const beforeBounce = travelled(landing) - travelled(sampleAtTime(fast, fast.flight - 0.02)!)
  const afterBounce = Math.hypot(sampleAtTime(fast, fast.flight + 0.02)!.x - landing.x, sampleAtTime(fast, fast.flight + 0.02)!.y - landing.y)
  assert.ok(afterBounce < beforeBounce * 0.8)
  const end = fast.samples.at(-1)!.t
  assert.equal(playbackTime(fast, 0), null)
  assert.equal(playbackTime(fast, end + 0.5), null)
  assert.ok(Math.abs(playbackTime(fast, end + 1.3)! - 0.3) < 1e-8)
})


test('execution safety takes priority over a precision winner against deep defenders', () => {
  let state = initialTactics()
  for (const [id, point] of [[1, { x: 2.3, y: 2.9 }], [2, { x: 7.9, y: 2.2 }], [3, { x: 2.5, y: 16.1 }], [4, { x: 8, y: 12.6 }]] as const) state = movePlayer(state, id, point)
  const difficult = { ...state, target: { x: 9.375, y: 7.875 }, speed: 12 }
  const oldTolerance = executionMargin(difficult)
  const result = chooseAutomaticShot(state)
  assert.ok(result.shot.valid)
  assert.ok(result.state.target.y <= 6.5)
  assert.ok(executionMargin(result.state) > oldTolerance + 0.5)
  assert.ok(evaluateShot(difficult).score > result.shot.score)
  const mirrored = { ...state, players: state.players.map(p => ({ ...p, x: 10 - p.x, y: 20 - p.y, team: p.team === 'you' ? 'opponents' as const : 'you' as const })) }
  const reverse = chooseAutomaticShot(mirrored)
  assert.deepEqual(reverse.state.target, { x: 10 - result.state.target.x, y: 20 - result.state.target.y })
})


test('target colours stay in the attacker perspective and lob pockets use eligible landing cells', async () => {
  const { coveredIsGood, lobLandingZones } = await import('../src/surfaces/tactics/targetZones.ts')
  for (const state of [initialTactics(), selectShooter(movePlayer(movePlayer(initialTactics(), 3, { x: 3, y: 12.5 }), 4, { x: 7, y: 12.5 }), 1)]) {
    const result = chooseAutomaticShot(state)
    const attackingUpper = result.state.ball.y < 10
    assert.equal(coveredIsGood(result.state, attackingUpper), true)
    assert.equal(coveredIsGood(result.state, !attackingUpper), false)
    const zones = lobLandingZones(result.cells)
    assert.ok(zones.length > 0)
    for (const zone of zones) {
      assert.equal(zone.y < 10, !attackingUpper)
      const centre = result.cells.find(p => p.x === zone.x && p.y === zone.y)
      assert.ok((centre?.lobScore ?? 0) >= 70)
      assert.ok(zone.rx > 0 && zone.ry > 0)
    }
  }
  assert.deepEqual(lobLandingZones([]), [])
})


test('the reported backcourt position keeps a repeatable cross-court shot instead of the short angle', () => {
  let state = initialTactics()
  state = movePlayer(movePlayer(state, 1, { x: 2.8, y: 2.35 }), 2, { x: 7.2, y: 2.35 })
  const delicate = { ...state, target: { x: 8.625, y: 7.625 }, speed: 12 }
  assert.ok(evaluateShot(delicate).valid)
  assert.equal(executionMargin(delicate), 0)
  const result = chooseAutomaticShot(state)
  assert.ok(result.state.target.x > 6.5 && result.state.target.x < 8.5)
  assert.ok(result.state.target.y < 6.5)
  assert.ok(executionMargin(result.state) >= 0.9)
  assert.ok(evaluateShot(delicate).score > result.shot.score)
  for (const point of [{ x: 0.35, y: 10.4 }, { x: 5, y: 10.4 }, { x: 9.65, y: 19.65 }]) {
    const edge = chooseAutomaticShot(movePlayer(state, 3, point))
    assert.ok(edge.shot.valid && executionMargin(edge.state) > 0)
  }
})


test('outside backhand preference follows handedness without bypassing execution safety', () => {
  let state = initialTactics()
  state = movePlayer(state, 1, { x: 2.4, y: 2.2 })
  state = movePlayer(state, 2, { x: 7.8, y: 2.2 })
  state = movePlayer(state, 3, { x: 3.9, y: 15.7 })
  const right = chooseAutomaticShot(state)
  assert.ok(right.state.target.x > state.players[1].x)
  assert.ok(right.state.target.y <= 6.5)
  assert.ok(executionMargin(right.state) > 0.7)
  assert.ok(backhandPressure(right.state, right.shot) > 0)
  const leftState = { ...state, players: state.players.map(p => ({ ...p, handedness: 'left' as const })) }
  // The identical right-side ball is a forehand option for a left-handed receiver.
  assert.ok(backhandPressure({ ...right.state, players: leftState.players }, right.shot) < 0)
  const left = chooseAutomaticShot(leftState)
  assert.ok(left.state.target.x < leftState.players[0].x)
  assert.ok(executionMargin(left.state) > 0.7)
  const flipped = { ...state, players: state.players.map(p => ({ ...p, x: 10 - p.x, y: 20 - p.y, team: p.team === 'you' ? 'opponents' as const : 'you' as const })) }
  assert.deepEqual(chooseAutomaticShot(flipped).state.target, { x: 10 - right.state.target.x, y: 20 - right.state.target.y })
})


test('ball height grows subtly above the net, shrinks on landing, and caps at lob height', async () => {
  const { ballRadiusAtHeight, sampleAtTime } = await import('../src/surfaces/tactics/shotPlayback.ts')
  assert.ok(ballRadiusAtHeight(1.1) > ballRadiusAtHeight(0.95))
  assert.ok(ballRadiusAtHeight(1.1) < ballRadiusAtHeight(0) * 1.3)
  assert.equal(ballRadiusAtHeight(-1), ballRadiusAtHeight(0))
  assert.equal(ballRadiusAtHeight(5), 12)
  assert.equal(ballRadiusAtHeight(20), 12)
  const state = initialTactics()
  const lob = evaluateShot({ ...state, kind: 'lob', speed: 7, target: { x: 5, y: 1 } })
  const peak = lob.samples.reduce((a, b) => a.z > b.z ? a : b)
  const landing = sampleAtTime(lob, lob.flight)!
  assert.ok(ballRadiusAtHeight(peak.z) > ballRadiusAtHeight(1.1))
  assert.ok(ballRadiusAtHeight(landing.z) < ballRadiusAtHeight(peak.z))
  const drive = chooseAutomaticShot(state).shot
  assert.ok(Math.max(...drive.samples.map(p => ballRadiusAtHeight(p.z))) < ballRadiusAtHeight(peak.z))
})
