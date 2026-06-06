import { useLayoutEffect } from 'react'

function screenWidthPx(): string {
  const w = window.visualViewport?.width ?? window.innerWidth
  return `${Math.round(w)}px`
}

function screenHeightPx(): string {
  const h = window.visualViewport?.height ?? window.innerHeight
  return `${Math.round(h)}px`
}

function applyViewportLock() {
  const width = screenWidthPx()
  const height = screenHeightPx()
  const html = document.documentElement
  const body = document.body

  html.style.setProperty('--app-width', width)
  html.style.setProperty('--app-height', height)
  html.style.overflow = 'hidden'
  html.style.position = 'fixed'
  html.style.inset = '0'
  html.style.width = width
  html.style.maxWidth = width
  html.style.height = height
  html.style.maxHeight = height

  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.inset = '0'
  body.style.width = width
  body.style.maxWidth = width
  body.style.height = height
  body.style.maxHeight = height
  body.style.margin = '0'

  const root = document.getElementById('root')
  if (root) {
    root.style.width = width
    root.style.maxWidth = width
    root.style.height = height
    root.style.maxHeight = height
    root.style.overflow = 'hidden'
  }

  const lock = document.querySelector<HTMLElement>('.viewport-lock')
  if (lock) {
    lock.style.width = width
    lock.style.maxWidth = width
    lock.style.height = height
    lock.style.maxHeight = height
    lock.style.overflow = 'hidden'
  }
}

function blockDocumentScroll(e: TouchEvent) {
  if (e.target instanceof Element && e.target.closest('[data-scroll-y]')) return
  e.preventDefault()
}

export function useLockViewport() {
  useLayoutEffect(() => {
    applyViewportLock()

    const onResize = () => applyViewportLock()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    document.addEventListener('touchmove', blockDocumentScroll, { passive: false })

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      document.removeEventListener('touchmove', blockDocumentScroll)
    }
  }, [])
}
