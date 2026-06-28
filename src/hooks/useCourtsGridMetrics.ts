import { useLayoutEffect, type RefObject } from 'react'
import type { GameCardSize } from '../lib/viewBreakpoints'

/** Publishes cell size + scale on the courts grid for landscape fill layouts. */
export function useCourtsGridMetrics(
  ref: RefObject<HTMLDivElement | null>,
  courtCount: number,
  size: GameCardSize,
  landscape: boolean,
) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || size === 'mobile' || !landscape || courtCount === 0) {
      return
    }

    const sync = () => {
      const height = el.clientHeight
      const width = el.clientWidth
      if (height <= 0 || width <= 0) return

      const cols = courtCount <= 1 ? 1 : 2
      const rows = Math.max(1, Math.ceil(courtCount / cols))
      const cellHeight = height / rows
      const cellWidth = width / cols
      const scale = Math.min(Math.max(cellHeight / 168, 0.8), 2.4)

      el.style.setProperty('--court-cell-height', `${cellHeight.toFixed(1)}px`)
      el.style.setProperty('--court-cell-width', `${cellWidth.toFixed(1)}px`)
      el.style.setProperty('--court-ui-scale', scale.toFixed(3))
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [courtCount, landscape, size])
}
