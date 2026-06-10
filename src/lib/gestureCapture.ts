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

/** Line-tool path: straight segment from start to end only. */
export function straightLinePath(
  start: NormalizedPoint,
  end: NormalizedPoint,
): NormalizedPoint[] {
  return [start, end]
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

/**
 * Finger position on the pad element. When the pad is visually rotated 90°
 * (CSS `rotate(90deg)`), map the screen point back into the pad's local space.
 */
export function clientToPadNormalized(
  clientX: number,
  clientY: number,
  pad: HTMLElement,
  rotated = false,
): NormalizedPoint {
  const rect = pad.getBoundingClientRect()
  if (!rotated) return clientToNormalized(clientX, clientY, rect)

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const w = pad.offsetWidth || rect.height
  const h = pad.offsetHeight || rect.width
  const dx = clientX - cx
  const dy = clientY - cy
  const localX = dy
  const localY = -dx
  return {
    x: Math.min(1, Math.max(0, 0.5 + localX / w)),
    y: Math.min(1, Math.max(0, 0.5 + localY / h)),
  }
}

export function normalizedToCanvas(
  point: NormalizedPoint,
  width: number,
  height: number,
): { x: number; y: number } {
  return { x: point.x * width, y: point.y * height }
}

/** Faded ball path while shot pick wheels are open. */
export const PENDING_BALL_PATH_ALPHA = 0.42

export function drawDimmedGesturePath(
  ctx: CanvasRenderingContext2D,
  points: NormalizedPoint[],
  width: number,
  height: number,
  alpha = PENDING_BALL_PATH_ALPHA,
) {
  if (points.length < 2) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 5
  ctx.strokeStyle = '#ffffff'
  drawGestureStroke(ctx, points, width, height)
  drawGestureMarkers(ctx, points, width, height)
  ctx.restore()
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

/** Live finger trail — slightly softer than the cleaned stroke. */
export function drawFreehandStroke(
  ctx: CanvasRenderingContext2D,
  points: NormalizedPoint[],
  width: number,
  height: number,
) {
  if (points.length < 2) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 4.5
  ctx.strokeStyle = 'rgba(255,255,255,0.88)'
  ctx.beginPath()
  const first = normalizedToCanvas(points[0]!, width, height)
  ctx.moveTo(first.x, first.y)
  if (points.length === 2) {
    const last = normalizedToCanvas(points[1]!, width, height)
    ctx.lineTo(last.x, last.y)
  } else {
    for (let i = 1; i < points.length - 1; i++) {
      const p = normalizedToCanvas(points[i]!, width, height)
      const next = normalizedToCanvas(points[i + 1]!, width, height)
      ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2)
    }
    const last = normalizedToCanvas(points[points.length - 1]!, width, height)
    ctx.lineTo(last.x, last.y)
  }
  ctx.stroke()
  ctx.restore()
}

export function drawGestureShotLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  end: NormalizedPoint,
  width: number,
  height: number,
  alpha = 1,
) {
  const { x, y } = normalizedToCanvas(end, width, height)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = '600 13px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const padX = 8
  const padY = 5
  const textW = ctx.measureText(label).width
  const boxW = textW + padX * 2
  const boxH = 20 + padY
  const boxX = x - boxW / 2
  const boxY = y - 12 - boxH
  ctx.fillStyle = 'rgba(0,0,0,0.62)'
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(boxX, boxY, boxW, boxH, 8)
    ctx.fill()
  } else {
    ctx.fillRect(boxX, boxY, boxW, boxH)
  }
  ctx.fillStyle = '#fde68a'
  ctx.fillText(label, x, y - 12)
  ctx.restore()
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
