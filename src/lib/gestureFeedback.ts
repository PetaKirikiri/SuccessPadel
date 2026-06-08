import type { Quadrant } from './gestureCapture'

export function gestureHapticStart(): void {
  navigator.vibrate?.(10)
}

export function gestureHapticQuadrantChange(): void {
  navigator.vibrate?.(6)
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
  if (!isDrawing) return 'bg-brand-surface/40'

  if (label === start && label === active) {
    return 'bg-brand-accent/25 ring-2 ring-inset ring-brand-accent'
  }
  if (label === start) return 'bg-emerald-500/15 ring-2 ring-inset ring-emerald-500/60'
  if (label === active) return 'bg-brand-accent/20 ring-2 ring-inset ring-brand-accent/70'
  return 'bg-brand-surface/25'
}
