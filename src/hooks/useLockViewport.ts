import { useLayoutEffect } from 'react'

function blockDocumentScroll(e: TouchEvent) {
  if (e.target instanceof Element && e.target.closest('[data-scroll-y]')) return
  e.preventDefault()
}

export function useLockViewport() {
  useLayoutEffect(() => {
    document.addEventListener('touchmove', blockDocumentScroll, { passive: false })

    return () => {
      document.removeEventListener('touchmove', blockDocumentScroll)
    }
  }, [])
}
