import type { RefObject } from 'react'
import { serverQuadrantFromHalfTap, type CourtHalf } from '../lib/courtPositionSetup'
import type { Quadrant } from '../lib/gestureCapture'

type Props = {
  padRef: RefObject<HTMLDivElement | null>
  onPickServe: (quadrant: Quadrant) => void
}

export function CourtServeSetup({ padRef, onPickServe }: Props) {
  const pickHalf = (half: CourtHalf, e: React.PointerEvent) => {
    e.stopPropagation()
    const pad = padRef.current
    if (!pad) return
    const quadrant = serverQuadrantFromHalfTap(half, e.clientY, pad.getBoundingClientRect())
    onPickServe(quadrant)
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[4] bg-black/25" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-[4] grid grid-cols-2">
        <div className="border-r border-dashed border-white/30" />
        <div />
      </div>
      <div className="absolute inset-0 z-[5] grid grid-cols-2">
        <button
          type="button"
          className="pointer-events-auto touch-none bg-white/5 transition hover:bg-white/15 active:bg-white/25"
          onPointerDown={(e) => pickHalf('left', e)}
          aria-label="Serve from left side"
        />
        <button
          type="button"
          className="pointer-events-auto touch-none bg-white/5 transition hover:bg-white/15 active:bg-white/25"
          onPointerDown={(e) => pickHalf('right', e)}
          aria-label="Serve from right side"
        />
      </div>
    </>
  )
}
