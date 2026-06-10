import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { clientToPadNormalized, type NormalizedPoint } from '../lib/gestureCapture'
import { pct, padNormToCourtNorm, type CourtInsetBounds } from '../lib/padelCourtLayout'

type Props = {
  padRef: RefObject<HTMLDivElement | null>
  rotatePad: boolean
  anchorPad: NormalizedPoint
  courtInset: CourtInsetBounds | null
  interactive?: boolean
  onMove?: (pad: NormalizedPoint) => void
  onLock?: (pad: NormalizedPoint) => void
}

export function GlassAnchorDrag({
  padRef,
  rotatePad,
  anchorPad,
  courtInset,
  interactive = true,
  onMove,
  onLock,
}: Props) {
  const [dragging, setDragging] = useState(false)
  const pointerIdRef = useRef<number | null>(null)

  const clamped = useCallback(
    (clientX: number, clientY: number): NormalizedPoint | null => {
      const pad = padRef.current
      if (!pad) return null
      return clientToPadNormalized(clientX, clientY, pad, rotatePad)
    },
    [padRef, rotatePad],
  )

  const courtPos = courtInset
    ? padNormToCourtNorm(anchorPad, courtInset)
    : anchorPad

  useEffect(() => {
    if (!interactive || !dragging) return
    const onMoveEvt = (e: PointerEvent) => {
      if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return
      const pt = clamped(e.clientX, e.clientY)
      if (pt) onMove?.(pt)
    }
    const end = (e: PointerEvent, cancelled: boolean) => {
      if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return
      pointerIdRef.current = null
      setDragging(false)
      if (cancelled) return
      const pt = clamped(e.clientX, e.clientY)
      if (pt) onLock?.(pt)
    }
    window.addEventListener('pointermove', onMoveEvt)
    window.addEventListener('pointerup', (e) => end(e, false))
    window.addEventListener('pointercancel', (e) => end(e, true))
    return () => {
      window.removeEventListener('pointermove', onMoveEvt)
      window.removeEventListener('pointerup', (e) => end(e, false))
      window.removeEventListener('pointercancel', (e) => end(e, true))
    }
  }, [clamped, dragging, interactive, onLock, onMove])

  const style = { left: pct(courtPos.x), top: pct(courtPos.y) }
  const className = interactive
    ? 'pointer-events-auto absolute z-[8] h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-emerald-200 bg-emerald-400/50 shadow-[0_0_10px_rgba(167,243,208,0.55)] touch-manipulation active:cursor-grabbing'
    : 'pointer-events-none absolute z-[8] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 bg-white/35'

  if (!interactive) {
    return <span data-glass-anchor className={className} style={style} aria-hidden />
  }

  return (
    <button
      type="button"
      data-glass-anchor
      className={className}
      style={style}
      aria-label="Glass contact"
      onPointerDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        pointerIdRef.current = e.pointerId
        setDragging(true)
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
    />
  )
}
