import type { HeatCell, Point, TacticsState } from './tacticsModel.ts'

export type LobLandingZone = Point & { rx: number; ry: number }

/** Colour means advantage to the selected attack, on either physical court half. */
export function coveredIsGood(state: TacticsState, upper: boolean): boolean {
  return upper === (state.ball.y < 10)
}

/** Inscribed landing pockets, so a lob never paints an entire defended backcourt green. */
export function lobLandingZones(cells: HeatCell[]): LobLandingZone[] {
  const eligible = cells.filter(p => (p.lobScore ?? 0) >= 70)
  const keys = new Set(eligible.map(p => `${Math.floor(p.x * 4)},${Math.floor(p.y * 4)}`))
  const zones: LobLandingZone[] = []
  for (const left of [true, false]) {
    const points = eligible.filter(p => left ? p.x < 5 : p.x >= 5)
    if (points.length < 24) continue
    const mean = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length }
    const centre = points.reduce((a, b) => Math.hypot(a.x - mean.x, a.y - mean.y) < Math.hypot(b.x - mean.x, b.y - mean.y) ? a : b)
    for (let scale = 1; scale >= 0.3; scale *= 0.8) {
      const rx = 1.35 * scale, ry = 0.85 * scale
      let fits = true
      for (let dx = -rx; dx <= rx; dx += 0.1) {
        for (let dy = -ry; dy <= ry; dy += 0.1) {
          if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1) continue
          if (!keys.has(`${Math.floor((centre.x + dx) * 4)},${Math.floor((centre.y + dy) * 4)}`)) fits = false
        }
      }
      if (fits) { zones.push({ x: centre.x, y: centre.y, rx, ry }); break }
    }
  }
  return zones
}
