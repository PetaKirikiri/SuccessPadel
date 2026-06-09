export type Quadrant = 'TL' | 'TR' | 'BL' | 'BR'

const PLAYER_BY_QUADRANT: Record<Quadrant, string> = {
  TL: 'Player 1',
  TR: 'Player 2',
  BL: 'Player 3',
  BR: 'Player 4',
}

export function playerLabel(
  quadrant: Quadrant,
  names?: Partial<Record<Quadrant, string>>,
): string {
  const custom = names?.[quadrant]?.trim()
  if (custom) return custom
  return PLAYER_BY_QUADRANT[quadrant]
}

export type NormalizedPoint = {
  x: number
  y: number
}

export type CapturedGesture = {
  startQuadrant: Quadrant
  endQuadrant: Quadrant
  start: NormalizedPoint
  end: NormalizedPoint
  pathPoints: NormalizedPoint[]
  code: string
}

export function quadrantFromPoint(point: NormalizedPoint): Quadrant {
  const horizontal = point.x < 0.5 ? 'L' : 'R'
  const vertical = point.y < 0.5 ? 'T' : 'B'
  return `${vertical}${horizontal}` as Quadrant
}

export function gestureCode(start: Quadrant, end: Quadrant): string {
  return `${start}_${end}`
}

export function captureGesture(pathPoints: NormalizedPoint[]): CapturedGesture | null {
  if (pathPoints.length < 2) return null

  const start = pathPoints[0]!
  const end = pathPoints[pathPoints.length - 1]!
  const startQuadrant = quadrantFromPoint(start)
  const endQuadrant = quadrantFromPoint(end)

  return {
    startQuadrant,
    endQuadrant,
    start,
    end,
    pathPoints,
    code: gestureCode(startQuadrant, endQuadrant),
  }
}

export function clientToNormalized(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): NormalizedPoint {
  const x = (clientX - rect.left) / rect.width
  const y = (clientY - rect.top) / rect.height
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  }
}

export function normalizedToCanvas(
  point: NormalizedPoint,
  width: number,
  height: number,
): { x: number; y: number } {
  return { x: point.x * width, y: point.y * height }
}

export function drawGestureStroke(
  ctx: CanvasRenderingContext2D,
  points: NormalizedPoint[],
  width: number,
  height: number,
) {
  if (points.length < 2) return
  ctx.beginPath()
  const first = normalizedToCanvas(points[0]!, width, height)
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < points.length; i++) {
    const p = normalizedToCanvas(points[i]!, width, height)
    ctx.lineTo(p.x, p.y)
  }
  ctx.stroke()
}

export function drawGestureMarkers(
  ctx: CanvasRenderingContext2D,
  points: NormalizedPoint[],
  width: number,
  height: number,
) {
  if (points.length === 0) return

  const start = normalizedToCanvas(points[0], width, height)
  const end = normalizedToCanvas(points[points.length - 1], width, height)

  ctx.beginPath()
  ctx.arc(start.x, start.y, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#6ee7b7'
  ctx.fill()

  if (points.length > 1) {
    for (let i = 1; i < points.length - 1; i++) {
      const anchor = normalizedToCanvas(points[i]!, width, height)
      ctx.beginPath()
      ctx.arc(anchor.x, anchor.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(end.x, end.y, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#fde68a'
    ctx.fill()
  }
}
