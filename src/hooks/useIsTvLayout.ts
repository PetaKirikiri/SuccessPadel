import { useEffect, useState } from 'react'
import { TV_MIN_WIDTH_PX } from '../lib/viewBreakpoints'

const TV_QUERY = `(min-width: ${TV_MIN_WIDTH_PX}px)`

function readTvLayout(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(TV_QUERY).matches
}

/** True only on TV-sized viewports (≥1536px). Phone/tablet/normal web stay false. */
export function useIsTvLayout(): boolean {
  const [isTvLayout, setIsTvLayout] = useState(readTvLayout)

  useEffect(() => {
    const mq = window.matchMedia(TV_QUERY)
    const update = () => setIsTvLayout(mq.matches)
    mq.addEventListener('change', update)
    update()
    return () => mq.removeEventListener('change', update)
  }, [])

  return isTvLayout
}
