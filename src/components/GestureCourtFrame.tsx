import type { CSSProperties, ReactNode } from 'react'
import { courtPadInsetFractions, type CourtLayout } from '../lib/padelCourtLayout'

export function gestureCourtInsetClass(layout: CourtLayout): string {
  return layout === 'landscape'
    ? 'inset-x-[10%] inset-y-[12%] sm:inset-x-[9%] sm:inset-y-[11%]'
    : 'inset-y-[13%] inset-x-[8%] sm:inset-y-[12%] sm:inset-x-[9%]'
}

export type CourtInsetMode = 'default' | 'max'

function maxInsetStyle(layout: CourtLayout): CSSProperties {
  const { x, y } = courtPadInsetFractions(layout)
  const top = `max(${(y * 100).toFixed(1)}%, env(safe-area-inset-top, 0px))`
  const bottom = `max(${(y * 100).toFixed(1)}%, env(safe-area-inset-bottom, 0px))`
  const left = `max(${(x * 100).toFixed(1)}%, env(safe-area-inset-left, 0px))`
  const right = `max(${(x * 100).toFixed(1)}%, env(safe-area-inset-right, 0px))`
  return { top, bottom, left, right }
}

type Props = {
  layout: CourtLayout
  insetMode?: CourtInsetMode
  zIndex?: number
  className?: string
  children: ReactNode
}

/** Inset + aspect box; rotates the court 90° in landscape so it fills the wide screen. */
export function GestureCourtInset({
  layout,
  insetMode = 'default',
  zIndex = 2,
  className = '',
  children,
}: Props) {
  const box = (
    <div className={`relative h-full max-w-full aspect-[10/20] ${className}`.trim()}>{children}</div>
  )

  return (
    <div
      data-court-inset
      className={
        insetMode === 'max'
          ? 'absolute flex items-center justify-center overflow-visible'
          : `absolute ${gestureCourtInsetClass(layout)} flex items-center justify-center overflow-visible`
      }
      style={insetMode === 'max' ? { zIndex, ...maxInsetStyle(layout) } : { zIndex }}
    >
      {layout === 'landscape' ? (
        <div className="gesture-court-landscape-rotator">{box}</div>
      ) : (
        box
      )}
    </div>
  )
}
