import { useViewportBucket } from '../contexts/ViewportContext'
import type { GameCardSize } from '../lib/viewBreakpoints'

export { useViewport, useViewportBucket } from '../contexts/ViewportContext'

/** Viewport bucket for game card layout — same as useViewportBucket. */
export function useGameCardSize(): GameCardSize {
  return useViewportBucket()
}
