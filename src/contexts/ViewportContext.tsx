import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listenToMediaQuery } from '../lib/dom/mediaQuery'
import {
  VIEWPORT_BUCKETS,
  viewportFromWidth,
  type ViewportBucket,
} from '../lib/viewBreakpoints'
import {
  readViewportLockMetrics,
  syncViewportLockDimensions,
  type ViewportOrientation,
} from '../lib/viewportLock'

type ViewportContextValue = {
  bucket: ViewportBucket
  orientation: ViewportOrientation
}

const ViewportContext = createContext<ViewportContextValue | null>(null)

function readSnapshot(): ViewportContextValue {
  if (typeof window === 'undefined') return { bucket: 'mobile', orientation: 'portrait' }
  const metrics = readViewportLockMetrics()
  return {
    bucket: viewportFromWidth(metrics.widthPx),
    orientation: metrics.orientation,
  }
}

export function ViewportProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ViewportContextValue>(readSnapshot)

  useEffect(() => {
    const orientationMq = window.matchMedia('(orientation: landscape)')
    const update = () => {
      const metrics = readViewportLockMetrics()
      syncViewportLockDimensions(metrics)
      setSnapshot({
        bucket: viewportFromWidth(metrics.widthPx),
        orientation: metrics.orientation,
      })
    }
    const delayedUpdate = () => {
      update()
      window.setTimeout(update, 150)
      window.setTimeout(update, 400)
    }
    const cleanupOrientation = listenToMediaQuery(orientationMq, delayedUpdate)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', delayedUpdate)
    window.visualViewport?.addEventListener('resize', update)
    update()
    return () => {
      cleanupOrientation()
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', delayedUpdate)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.viewport = snapshot.bucket
    document.documentElement.dataset.orientation = snapshot.orientation
    return () => {
      delete document.documentElement.dataset.viewport
      delete document.documentElement.dataset.orientation
    }
  }, [snapshot.bucket, snapshot.orientation])

  const value = useMemo(() => snapshot, [snapshot])

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
