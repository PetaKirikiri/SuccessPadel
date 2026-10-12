import { courtView, screenPoint } from './drawCourt'
import type { Point } from './tacticsModel'
import type { TargetArea } from './tacticsChallenges'

export function drawChallenge(canvas: HTMLCanvasElement, choice: Point | null, area: TargetArea | null, active: Point | null) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const view = courtView(canvas.clientWidth, canvas.clientHeight)
  ctx.save()
  ctx.setTransform(canvas.width / canvas.clientWidth, 0, 0, canvas.height / canvas.clientHeight, 0, 0)
  if (area) {
    const a = screenPoint({ x: area.left, y: area.top }, view), b = screenPoint({ x: area.right, y: area.bottom }, view)
    ctx.fillStyle = '#8ae8ad66'; ctx.strokeStyle = '#b7ffcf'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); ctx.fill(); ctx.stroke()
  }
  if (active) {
    const p = screenPoint(active, view)
    ctx.strokeStyle = '#8eeaff'; ctx.lineWidth = 3; ctx.setLineDash([5, 4])
    ctx.beginPath(); ctx.arc(p.x, p.y, 33, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
  }
  if (choice) {
    const p = screenPoint(choice, view)
    ctx.strokeStyle = '#fff2a8'; ctx.fillStyle = '#ffe477'; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
}
