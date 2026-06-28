import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listenToMediaQuery } from '../lib/dom/mediaQuery'
import {
  TABLET_MIN_WIDTH_PX,
  TV_MIN_WIDTH_PX,
  VIEWPORT_BUCKETS,
  WEB_MIN_WIDTH_PX,
  viewportFromWidth,
  type ViewportBucket,
} from '../lib/viewBreakpoints'

type ViewportContextValue = {
  bucket: ViewportBucket
}

const ViewportContext = createContext<ViewportContextValue | null>(null)

function readWidthPx(): number {
  if (typeof window === 'undefined') return 0
  return Math.round(window.visualViewport?.width ?? window.innerWidth)
}

function readBucket(): ViewportBucket {
  return viewportFromWidth(readWidthPx())
}

export function ViewportProvider({ children }: { children: ReactNode }) {
  const [bucket, setBucket] = useState<ViewportBucket>(readBucket)

  useEffect(() => {
    const tabletMq = window.matchMedia(`(min-width: ${TABLET_MIN_WIDTH_PX}px)`)
    const webMq = window.matchMedia(`(min-width: ${WEB_MIN_WIDTH_PX}px)`)
    const tvMq = window.matchMedia(`(min-width: ${TV_MIN_WIDTH_PX}px)`)
    const update = () => setBucket(readBucket())
    const cleanups = [
      listenToMediaQuery(tabletMq, update),
      listenToMediaQuery(webMq, update),
      listenToMediaQuery(tvMq, update),
    ]
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    update()
    return () => {
      cleanups.forEach((cleanup) => cleanup())
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.viewport = bucket
    return () => {
      delete document.documentElement.dataset.viewport
    }
  }, [bucket])

  const value = useMemo(() => ({ bucket }), [bucket])

  return <ViewportContext.Provider value={value}>{children}</ViewportContext.Provider>
}

export function useViewport(): ViewportContextValue {
  const ctx = useContext(ViewportContext)
  if (!ctx) {
    throw new Error('useViewport must be used within ViewportProvider')
  }
  return ctx
}

export function useViewportBucket(): ViewportBucket {
  return useViewport().bucket
}

export { VIEWPORT_BUCKETS, type ViewportBucket }
