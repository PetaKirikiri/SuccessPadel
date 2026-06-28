import { useLayoutEffect } from 'react'
import { syncViewportLockDimensions } from '../lib/viewportLock'

function blockDocumentScroll(e: TouchEvent) {
  if (e.target instanceof Element && e.target.closest('[data-scroll-y]')) return
  e.preventDefault()
}

export function useLockViewport() {
  useLayoutEffect(() => {
    syncViewportLockDimensions()

    const onResize = () => syncViewportLockDimensions()
    const onOrientation = () => {
      syncViewportLockDimensions()
      window.setTimeout(syncViewportLockDimensions, 150)
      window.setTimeout(syncViewportLockDimensions, 400)
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrientation)
    document.addEventListener('touchmove', blockDocumentScroll, { passive: false })

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrientation)
      document.removeEventListener('touchmove', blockDocumentScroll)
    }
  }, [])
}
