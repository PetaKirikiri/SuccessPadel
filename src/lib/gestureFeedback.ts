import type { Quadrant } from './gestureCapture'

export function gestureHapticStart(): void {
  navigator.vibrate?.(10)
}

export function gestureHapticQuadrantChange(): void {
  navigator.vibrate?.(6)
}

export function gestureHapticAnchor(): void {
  navigator.vibrate?.(8)
}

export function gestureHapticComplete(): void {
  navigator.vibrate?.([15, 35, 25])
}

export function quadrantHighlightClass(
  label: Quadrant,
  start: Quadrant | null,
  active: Quadrant | null,
  isDrawing: boolean,
): string {
  if (!isDrawing) return 'bg-transparent'

  if (label === start && label === active) {
    return 'bg-white/25 ring-2 ring-inset ring-white/90'
  }
  if (label === start) return 'bg-emerald-300/20 ring-2 ring-inset ring-emerald-200/80'
  if (label === active) return 'bg-amber-200/20 ring-2 ring-inset ring-amber-100/80'
  return 'bg-black/5'
}

export function serveFeedbackQuadrantClass(
  label: Quadrant,
  server: Quadrant,
  receive: Quadrant,
  isDrawing: boolean,
  start: Quadrant | null,
  active: Quadrant | null,
): string {
  if (isDrawing) return quadrantHighlightClass(label, start, active, true)
  if (label === receive) {
    return 'animate-pulse bg-amber-300/35 ring-2 ring-inset ring-amber-200/95 transition-colors duration-300'
  }
  if (label === server) {
    return 'bg-emerald-300/18 ring-1 ring-inset ring-emerald-200/60 transition-colors duration-300'
  }
  return 'bg-black/5'
}
