import { COURT, clamp } from './tacticsModel'
import { coverageShadows } from './coverageShadows'
import { ballLiftAtHeight, ballRadiusAtHeight, sampleAtTime } from './shotPlayback'
import { coveredIsGood, lobLandingZones } from './targetZones'
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
  const lobs = lobLandingZones(cells)
  // Attacking perspective: opponents' gaps are targets; our own gaps are exposed.
  for (const upper of [true, false]) {
    ctx.fillStyle = coveredIsGood(state, upper) ? '#f29a96' : '#70cf9b'
    ctx.fillRect(0, upper ? 0 : 10, 10, 10)
  }
  for (const shadow of coverageShadows(state, shot)) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, shadow.upper ? 0 : 10, 10, 10); ctx.clip()
    ctx.fillStyle = coveredIsGood(state, shadow.upper) ? '#70cf9b' : '#f29a96'
    ctx.beginPath()
    shadow.polygon.forEach((p, i) => { if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y) })
    ctx.closePath(); ctx.fill()
    ring(ctx, shadow.centre, shadow.radius); ctx.fill()
    ctx.restore()
  }
  // A viable lob goes over the normal blocking shadow, opening a green landing pocket.
  for (const zone of lobs) {
    ctx.beginPath(); ctx.ellipse(zone.x, zone.y, zone.rx, zone.ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#70cf9b'; ctx.fill()
    ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 0.025; ctx.setLineDash([0.1, 0.1]); ctx.stroke(); ctx.setLineDash([])
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

  // Optional lofted-shot cues: a small arc ending in a dashed landing ring.
  // They remain separate from the straight recommended trajectory.
  for (const zone of lobs) {
    const p = screenPoint(zone, view)
    ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 1.8; ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.ellipse(p.x + 12, p.y + 4, 9, 4, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(p.x - 14, p.y + 2)
    ctx.bezierCurveTo(p.x - 12, p.y - 25, p.x + 10, p.y - 25, p.x + 12, p.y - 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(p.x + 8, p.y - 7); ctx.lineTo(p.x + 12, p.y - 2); ctx.lineTo(p.x + 15, p.y - 8); ctx.stroke()
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
  // A hollow landing guide leaves the actual ball visible as it shrinks at the bounce.
  ctx.strokeStyle = '#ffffffb3'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3])
  ring(ctx, target, 9); ctx.stroke(); ctx.setLineDash([])
  for (const player of state.players) {
    const p = screenPoint(player, view), radius = clamp(s * 0.52, 22, 28)
    const color = state.ballOwner === player.id ? '#efffa3' : player.team === 'you' ? '#edf8ff' : '#ffbd8f'
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
}

/** Painted over a cached court so animation never reruns the tactical calculation. */
export function drawShotPlayback(canvas: HTMLCanvasElement, state: TacticsState, shot: Shot, time: number) {
  const ctx = canvas.getContext('2d')
  const ball = sampleAtTime(shot, time)
  if (!ctx || !ball) return
  const view = courtView(canvas.clientWidth, canvas.clientHeight)
  const ground = screenPoint(ball, view)
  const head = { x: ground.x, y: ground.y - ballLiftAtHeight(ball.z) }
  const source = screenPoint(state.ball, view)
  const radius = ballRadiusAtHeight(ball.z)
  // Emerge from inside the shooter without painting over their number.
  if (Math.hypot(ground.x - source.x, ground.y - source.y) < clamp(view.scale * 0.52, 22, 28) + radius) return
  ctx.save()
  const dpr = canvas.width / canvas.clientWidth
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineCap = 'round'
  // A stable floor reference makes the size change read as height, not inflation.
  const height = clamp(ball.z, 0, 5)
  ctx.save()
  ctx.fillStyle = `rgba(9, 40, 43, ${0.3 - height * 0.035})`
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 1 + height
  ctx.beginPath(); ctx.ellipse(ground.x, ground.y + 1.5, 4 + height * 0.35, 2 + height * 0.15, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // Equal time histories naturally make fast shots longer and slow shots shorter.
  const history = 0.065, segments = 10
  for (let i = 0; i < segments; i++) {
    const a = sampleAtTime(shot, Math.max(0, time - history + history * i / segments))
    const b = sampleAtTime(shot, Math.max(0, time - history + history * (i + 1) / segments))
    if (!a || !b) continue
    const start = screenPoint(a, view), end = screenPoint(b, view)
    if (Math.hypot(start.x - source.x, start.y - source.y) < clamp(view.scale * 0.52, 22, 28) + 3) continue
    start.y -= ballLiftAtHeight(a.z); end.y -= ballLiftAtHeight(b.z)
    ctx.globalAlpha = 0.04 + 0.3 * (i + 1) / segments
    ctx.lineWidth = 0.7 + ballRadiusAtHeight(b.z) * 0.48 * (i + 1) / segments
    ctx.strokeStyle = '#fff58a'
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke()
  }
  ctx.globalAlpha = 1
  const light = ctx.createRadialGradient(head.x - radius * 0.3, head.y - radius * 0.35, radius * 0.1, head.x, head.y, radius)
  light.addColorStop(0, '#fffed0'); light.addColorStop(0.4, '#fff36b'); light.addColorStop(1, '#d7d947')
  ring(ctx, head, radius); ctx.fillStyle = light; ctx.fill()
  ctx.strokeStyle = '#63723099'; ctx.lineWidth = 1; ctx.stroke()
  ctx.restore()
}
