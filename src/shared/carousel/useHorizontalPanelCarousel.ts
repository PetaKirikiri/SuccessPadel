import { useCallback, useEffect, useRef } from 'react'
import { panelScrollBehavior } from '../../lib/motion'

type Options = {
  activeIndex: number
  panelCount: number
  onIndexChange?: (index: number) => void
}

export function useHorizontalPanelCarousel({ activeIndex, panelCount, onIndexChange }: Options) {
  const trackRef = useRef<HTMLDivElement>(null)
  const ignoreScrollRef = useRef(false)

  const scrollToIndex = useCallback(
    (index: number, smooth: boolean) => {
      const track = trackRef.current
      if (!track || panelCount <= 0) return
      const clamped = Math.max(0, Math.min(panelCount - 1, index))
      const width = track.clientWidth
      if (width <= 0) return
      ignoreScrollRef.current = true
      track.scrollTo({ left: clamped * width, behavior: panelScrollBehavior(smooth) })
      window.setTimeout(
        () => {
          ignoreScrollRef.current = false
        },
        smooth ? 320 : 0,
      )
    },
    [panelCount],
  )

  useEffect(() => {
    scrollToIndex(activeIndex, true)
  }, [activeIndex, scrollToIndex])

  const onScroll = useCallback(() => {
    if (ignoreScrollRef.current) return
    const track = trackRef.current
    if (!track || panelCount <= 0) return
    const width = track.clientWidth
    if (width <= 0) return
    const index = Math.round(track.scrollLeft / width)
    const clamped = Math.max(0, Math.min(panelCount - 1, index))
    onIndexChange?.(clamped)
  }, [onIndexChange, panelCount])

  return { trackRef, onScroll, scrollToIndex }
}
