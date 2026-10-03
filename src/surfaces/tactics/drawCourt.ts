import { COURT, clamp } from './tacticsModel'
import type { HeatCell, Point, Shot, TacticsState } from './tacticsModel'

export type CourtView = { width: number; height: number; scale: number; left: number; top: number; rotated: boolean }
export function courtView(width: number, height: number): CourtView {
  const rotated = width > height
  const scale = Math.min((width - 8) / (rotated ? 20 : 10), (height - 8) / (rotated ? 10 : 20))
  return { width, height, scale, rotated, left: (width - scale * (rotated ? 20 : 10)) / 2, top: (height - scale * (rotated ? 10 : 20)) / 2 }
}
export function screenPoint(p: Point, view: CourtView): Point {
  return { x: view.left + (view.rotated ? p.y : p.x) * view.scale, y: view.top + (view.rotated ? 10 - p.x : p.y) * view.scale }
}
export function courtPoint(p: Point, view: CourtView): Point {
  return view.rotated
    ? { x: 10 - (p.y - view.top) / view.scale, y: (p.x - view.left) / view.scale }
    : { x: (p.x - view.left) / view.scale, y: (p.y - view.top) / view.scale }
}
const ring = (ctx: CanvasRenderingContext2D, p: Point, r: number) => { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2) }

export function drawCourt(canvas: HTMLCanvasElement, state: TacticsState, cells: HeatCell[], shot: Shot, selected: string) {
  const width = canvas.clientWidth, height = canvas.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx || width < 1 || height < 160) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const view = courtView(width, height)
  const s = view.scale
  ctx.save()
  ctx.translate(view.left, view.top)
  if (view.rotated) { ctx.translate(0, 10 * s); ctx.rotate(-Math.PI / 2) }
  ctx.scale(s, s)
  ctx.fillStyle = '#4197b0'; ctx.fillRect(0, 0, 10, 20)
  // Subtle alternating turf strips keep the court visible beneath tactical zones.
  ctx.fillStyle = '#ffffff04'
  for (let y = 0; y < 20; y += 4) ctx.fillRect(0, y, 10, 2)
  // Three visual states only: green, coral, or the neutral blue court.
  // Remove small disconnected patches so sampling noise never becomes a game cue.
  const zones: { kind: number; upper: boolean; points: Point[] }[] = []
  if (cells.length) {
    const heat = document.createElement('canvas'); heat.width = 240; heat.height = 480
    const hc = heat.getContext('2d')!
    const pixels = hc.createImageData(heat.width, heat.height)
    const scores = new Float32Array(3200), kinds = new Int8Array(3200)
    cells.forEach(cell => { scores[Math.floor(cell.y * 4) * 40 + Math.floor(cell.x * 4)] = cell.score / 100 })
    for (let y = 0; y < 80; y++) for (let x = 0; x < 40; x++) {
      let value = 0
      const half = y < 40 ? 0 : 40
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        value += scores[clamp(y + dy, half, half + 39) * 40 + clamp(x + dx, 0, 39)] / 9
      }
      kinds[y * 40 + x] = value >= 0.7 ? 1 : value <= 0.2 ? -1 : 0
    }
    const visited = new Uint8Array(3200)
    for (let start = 0; start < 3200; start++) {
      if (visited[start] || !kinds[start]) continue
      const kind = kinds[start], upper = start < 1600, members = [start]
      visited[start] = 1
      for (let cursor = 0; cursor < members.length; cursor++) {
        const index = members[cursor], x = index % 40, y = Math.floor(index / 40)
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || nx >= 40 || ny < (upper ? 0 : 40) || ny >= (upper ? 40 : 80)) continue
          const next = ny * 40 + nx
          if (!visited[next] && kinds[next] === kind) { visited[next] = 1; members.push(next) }
        }
      }
      if (members.length < 24) { members.forEach(index => { kinds[index] = 0 }); continue }
      zones.push({ kind, upper, points: members.map(index => ({ x: (index % 40 + 0.5) / 4, y: (Math.floor(index / 40) + 0.5) / 4 })) })
    }
    // Smooth the masks, then draw flat-colour boundaries at phone resolution.
    // Only the edge is antialiased; there are no extra colour/strength bands.
    const green = new Float32Array(3200), red = new Float32Array(3200)
    const weights = [1, 2, 1]
    for (let y = 0; y < 80; y++) for (let x = 0; x < 40; x++) {
      const half = y < 40 ? 0 : 40
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const kind = kinds[clamp(y + dy, half, half + 39) * 40 + clamp(x + dx, 0, 39)]
        if (kind) (kind > 0 ? green : red)[y * 40 + x] += weights[dx + 1] * weights[dy + 1] / 16
      }
    }
    for (let y = 0; y < heat.height; y++) for (let x = 0; x < heat.width; x++) {
      const gx = clamp((x + 0.5) / 6 - 0.5, 0, 39), half = y < 240 ? 0 : 40
      const gy = clamp((y + 0.5) / 6 - 0.5, half, half + 39)
      const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0
      const sample = (field: Float32Array) =>
        (field[y0 * 40 + x0] * (1 - fx) + field[y0 * 40 + Math.min(x0 + 1, 39)] * fx) * (1 - fy) +
        (field[Math.min(y0 + 1, half + 39) * 40 + x0] * (1 - fx) + field[Math.min(y0 + 1, half + 39) * 40 + Math.min(x0 + 1, 39)] * fx) * fy
      const good = sample(green), bad = sample(red), strength = Math.max(good, bad)
      if (strength < 0.46) continue
      const color = good > bad ? [109, 213, 147] : [246, 145, 145]
      const index = (y * heat.width + x) * 4
      for (let c = 0; c < 3; c++) pixels.data[index + c] = color[c]
      pixels.data[index + 3] = clamp((strength - 0.46) / 0.08, 0, 1) * 255
    }
    hc.putImageData(pixels, 0, 0)
    ctx.imageSmoothingEnabled = true; ctx.drawImage(heat, 0, 0, 10, 20)
  }
  ctx.strokeStyle = '#ffffffd9'; ctx.lineWidth = 0.04
  ctx.strokeRect(0, 0, 10, 20)
  ctx.beginPath()
  for (const y of [10 - COURT.service, 10 + COURT.service]) { ctx.moveTo(0, y); ctx.lineTo(10, y) }
  ctx.moveTo(5, 10 - COURT.service - 0.2); ctx.lineTo(5, 10 + COURT.service + 0.2); ctx.stroke()
  // Glass edges and mesh sections.
  ctx.strokeStyle = '#d5edf1'; ctx.lineWidth = 0.085
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 0); ctx.lineTo(10, 0); ctx.lineTo(10, 4)
  ctx.moveTo(0, 16); ctx.lineTo(0, 20); ctx.lineTo(10, 20); ctx.lineTo(10, 16); ctx.stroke()
  ctx.fillStyle = '#081d29b0'; ctx.fillRect(-0.06, 9.91, 10.12, 0.23)
  ctx.strokeStyle = '#f5fcf5'; ctx.lineWidth = 0.055
  ctx.beginPath(); ctx.moveTo(-0.08, 10); ctx.lineTo(10.08, 10); ctx.stroke()
  ctx.strokeStyle = '#dff0ed50'; ctx.lineWidth = 0.025
  for (let x = 0; x <= 10; x += 0.16) { ctx.beginPath(); ctx.moveTo(x, 9.91); ctx.lineTo(x, 10.14); ctx.stroke() }
  ctx.restore()

  const aim = screenPoint(state.target, view)
  const aimPositions = [[0, 29], [0, -29], [62, 0], [-62, 0], [0, 48], [0, -48]].map(([dx, dy]) => ({ x: clamp(aim.x + dx, 52, width - 52), y: clamp(aim.y + dy, 18, height - 18) }))
  const aimPosition = aimPositions.find(point => Math.hypot(point.x - aim.x, point.y - aim.y) >= 26 && state.players.every(player => {
    const p = screenPoint(player, view)
    return Math.abs(point.x - p.x) > 70 || Math.abs(point.y - p.y) > 38
  })) ?? aimPositions[0]
  const labels: { point: Point; text: string; good: boolean }[] = [
    { point: aimPosition, text: shot.score >= 55 ? 'Aim here' : 'Best option', good: shot.score >= 55 },
  ]
  const shootingUpper = state.ball.y < 10
  for (const upper of [true, false]) {
    const danger = zones.filter(z => z.upper === upper && z.kind < 0).sort((a, b) => b.points.length - a.points.length)[0]
    if (danger) addZoneLabel(danger.points, upper === shootingUpper ? '! Exposed' : '! Avoid', false)
    if (upper === shootingUpper) {
      for (const zone of zones.filter(z => z.upper === upper && z.kind > 0).sort((a, b) => b.points.length - a.points.length).slice(0, 2)) {
        addZoneLabel(zone.points, '✓ Covered', true)
      }
    }
  }
  for (const left of [true, false]) {
    const zone = cells.filter(cell => (cell.lobScore ?? 0) >= 70 && (left ? cell.x < 5 : cell.x >= 5))
    if (zone.length >= 24) addZoneLabel(zone, 'Lob', true)
  }
  function addZoneLabel(points: Point[], text: string, good: boolean) {
    const centre = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length }
    const candidates = points.map(point => ({ point, screen: screenPoint(point, view) })).filter(({ screen }) =>
      screen.x > 47 && screen.x < width - 47 && screen.y > 18 && screen.y < height - 18 &&
      state.players.every(p => Math.hypot(screen.x - screenPoint(p, view).x, screen.y - screenPoint(p, view).y) > 46) &&
      Math.hypot(screen.x - screenPoint(state.target, view).x, screen.y - screenPoint(state.target, view).y) > 55 &&
      labels.every(label => Math.abs(screen.x - label.point.x) > 90 || Math.abs(screen.y - label.point.y) > 30),
    )
    const anchor = candidates.sort((a, b) => Math.hypot(a.point.x - centre.x, a.point.y - centre.y) - Math.hypot(b.point.x - centre.x, b.point.y - centre.y))[0]
    if (anchor) labels.push({ point: anchor.screen, text, good })
  }

  // Trajectory in court projection; the dotted segment is after the first bounce.
  for (const bounced of [false, true]) {
    const points = shot.samples.filter(p => p.bounced === bounced)
    if (bounced) { const landing = shot.samples.findLast(p => !p.bounced); if (landing) points.unshift(landing) }
    ctx.beginPath(); ctx.setLineDash(bounced ? [4, 6] : [])
    points.forEach((p, i) => { const q = screenPoint(p, view); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y) })
    ctx.lineWidth = bounced ? 1.3 : 2.5; ctx.strokeStyle = shot.valid ? (bounced ? '#f5ffd15c' : '#f5ffd1') : '#ff9b83'; ctx.stroke()
  }
  ctx.setLineDash([])
  const target = screenPoint(state.target, view)
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5
  ring(ctx, target, 11); ctx.fillStyle = shot.score >= 55 ? '#22955a' : '#377b95'; ctx.fill(); ctx.stroke()
  ring(ctx, target, 4); ctx.fillStyle = '#ffffff'; ctx.fill()
  for (const player of state.players) {
    const p = screenPoint(player, view), radius = clamp(s * 0.43, 14, 26)
    const color = player.team === 'you' ? '#edf8ff' : '#ffbd8f'
    if (state.ballOwner === player.id) {
      ring(ctx, p, radius + 5); ctx.strokeStyle = '#edff82'; ctx.lineWidth = 2; ctx.stroke()
    } else if (selected === `player-${player.id}`) {
      ring(ctx, p, radius + 5); ctx.strokeStyle = `${color}99`; ctx.lineWidth = 1.5; ctx.stroke()
    }
    ctx.shadowColor = '#06273580'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2
    ring(ctx, p, radius); ctx.fillStyle = color; ctx.fill()
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    ctx.strokeStyle = '#103747'; ctx.lineWidth = 2; ctx.stroke()
    ctx.font = `600 ${Math.max(13, radius * 0.95)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#133536'; ctx.fillText(String(player.id), p.x, p.y + 0.5)
  }
  for (const label of labels) {
    ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const w = ctx.measureText(label.text).width + 20
    ctx.beginPath(); ctx.roundRect(label.point.x - w / 2, label.point.y - 12, w, 24, 12)
    ctx.fillStyle = '#ffffffed'; ctx.fill()
    ctx.strokeStyle = label.good ? '#238353' : '#bc4654'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = label.good ? '#176f46' : '#a73343'; ctx.fillText(label.text, label.point.x, label.point.y)
  }
  const ball = screenPoint(state.ball, view)
  ring(ctx, ball, 11); ctx.fillStyle = '#efff8830'; ctx.fill()
  ring(ctx, ball, 6.5); ctx.fillStyle = '#edff82'; ctx.fill(); ctx.strokeStyle = '#fffed9'; ctx.lineWidth = 1; ctx.stroke()
}
