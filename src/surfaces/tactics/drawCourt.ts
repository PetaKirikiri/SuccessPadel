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
  ctx.fillStyle = '#164b59'; ctx.fillRect(0, 0, 10, 20)
  ctx.fillStyle = '#195563'; ctx.fillRect(0, 0, 10, 10)
  // Smooth the scalar field before colouring, separately on either side of the
  // net. Coral and mint meet through a light neutral instead of muddy brown.
  if (cells.length) {
    const heat = document.createElement('canvas'); heat.width = 40; heat.height = 80
    const hc = heat.getContext('2d')!
    const pixels = hc.createImageData(40, 80)
    const scores = new Float32Array(3200)
    cells.forEach(cell => {
      scores[Math.floor(cell.y * 4) * 40 + Math.floor(cell.x * 4)] = cell.score / 100
    })
    const weights = [1, 6, 15, 20, 15, 6, 1]
    const horizontal = new Float32Array(3200)
    for (let y = 0; y < 80; y++) for (let x = 0; x < 40; x++) {
      for (let k = -3; k <= 3; k++) horizontal[y * 40 + x] += scores[y * 40 + clamp(x + k, 0, 39)] * weights[k + 3] / 64
    }
    const red = [255, 133, 145], neutral = [241, 244, 227], green = [67, 218, 161]
    for (let y = 0; y < 80; y++) for (let x = 0; x < 40; x++) {
      let value = 0
      const half = y < 40 ? 0 : 40
      for (let k = -3; k <= 3; k++) value += horizontal[clamp(y + k, half, half + 39) * 40 + x] * weights[k + 3] / 64
      const i = (y * 40 + x) * 4
      const from = value < 0.5 ? red : neutral
      const to = value < 0.5 ? neutral : green
      const blend = value < 0.5 ? value * 2 : (value - 0.5) * 2
      for (let c = 0; c < 3; c++) pixels.data[i + c] = from[c] + (to[c] - from[c]) * blend
      pixels.data[i + 3] = 255
    }
    hc.putImageData(pixels, 0, 0)
    ctx.imageSmoothingEnabled = true; ctx.drawImage(heat, 0, 0, 10, 20)
  }
  ctx.strokeStyle = '#b2d5d3'; ctx.lineWidth = 0.045
  ctx.strokeRect(0, 0, 10, 20)
  ctx.beginPath()
  for (const y of [10 - COURT.service, 10 + COURT.service]) { ctx.moveTo(0, y); ctx.lineTo(10, y) }
  ctx.moveTo(5, 10 - COURT.service - 0.2); ctx.lineTo(5, 10 + COURT.service + 0.2); ctx.stroke()
  // Glass edges and mesh sections.
  ctx.strokeStyle = '#bee9e6'; ctx.lineWidth = 0.11
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 0); ctx.lineTo(10, 0); ctx.lineTo(10, 4)
  ctx.moveTo(0, 16); ctx.lineTo(0, 20); ctx.lineTo(10, 20); ctx.lineTo(10, 16); ctx.stroke()
  ctx.fillStyle = '#081d29b0'; ctx.fillRect(-0.06, 9.91, 10.12, 0.23)
  ctx.strokeStyle = '#f5fcf5'; ctx.lineWidth = 0.055
  ctx.beginPath(); ctx.moveTo(-0.08, 10); ctx.lineTo(10.08, 10); ctx.stroke()
  ctx.strokeStyle = '#dff0ed50'; ctx.lineWidth = 0.025
  for (let x = 0; x <= 10; x += 0.16) { ctx.beginPath(); ctx.moveTo(x, 9.91); ctx.lineTo(x, 10.14); ctx.stroke() }
  ctx.restore()

  // One small on-court label per useful lob region; no controls or legend.
  for (const left of [true, false]) {
    const zone = cells.filter(cell => (cell.lobScore ?? 0) >= 65 && (left ? cell.x < 5 : cell.x >= 5))
    if (zone.length < 8) continue
    const centre = { x: zone.reduce((sum, p) => sum + p.x, 0) / zone.length, y: zone.reduce((sum, p) => sum + p.y, 0) / zone.length }
    const anchor = zone.reduce((nearest, p) => Math.hypot(p.x - centre.x, p.y - centre.y) < Math.hypot(nearest.x - centre.x, nearest.y - centre.y) ? p : nearest)
    const p = screenPoint(anchor, view)
    ctx.font = '600 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#084a35c9'; ctx.beginPath(); ctx.roundRect(p.x - 24, p.y - 13, 48, 26, 13); ctx.fill()
    ctx.fillStyle = '#e5fff0'; ctx.fillText('Lob', p.x, p.y)
  }

  // Trajectory in court projection; the dotted segment is after the first bounce.
  for (const bounced of [false, true]) {
    const points = shot.samples.filter(p => p.bounced === bounced)
    if (bounced) { const landing = shot.samples.findLast(p => !p.bounced); if (landing) points.unshift(landing) }
    ctx.beginPath(); ctx.setLineDash(bounced ? [4, 6] : [])
    points.forEach((p, i) => { const q = screenPoint(p, view); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y) })
    ctx.lineWidth = bounced ? 1.7 : 2.3; ctx.strokeStyle = shot.valid ? (bounced ? '#fff0a699' : '#fff4ac') : '#ff9b83'; ctx.stroke()
  }
  ctx.setLineDash([])
  const target = screenPoint(state.target, view)
  ctx.strokeStyle = '#fff4ac'; ctx.lineWidth = 1.5
  ring(ctx, target, 5); ctx.stroke()
  for (const player of state.players) {
    const p = screenPoint(player, view), radius = clamp(s * 0.43, 14, 26)
    const color = player.team === 'you' ? '#c1eee0' : '#f9a48b'
    if (state.ballOwner === player.id) {
      ring(ctx, p, radius + 5); ctx.strokeStyle = '#edff82'; ctx.lineWidth = 2; ctx.stroke()
    } else if (selected === `player-${player.id}`) {
      ring(ctx, p, radius + 5); ctx.strokeStyle = `${color}99`; ctx.lineWidth = 1.5; ctx.stroke()
    }
    ctx.shadowColor = '#03181d88'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3
    ring(ctx, p, radius); ctx.fillStyle = color; ctx.fill()
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    ctx.strokeStyle = '#fff9'; ctx.lineWidth = 1; ctx.stroke()
    ctx.font = `600 ${Math.max(13, radius * 0.95)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#133536'; ctx.fillText(String(player.id), p.x, p.y + 0.5)
  }
  const ball = screenPoint(state.ball, view)
  ring(ctx, ball, 11); ctx.fillStyle = '#efff8830'; ctx.fill()
  ring(ctx, ball, 6.5); ctx.fillStyle = '#edff82'; ctx.fill(); ctx.strokeStyle = '#fffed9'; ctx.lineWidth = 1; ctx.stroke()
}
