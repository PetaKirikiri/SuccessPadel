/** Shared viewport lock dimensions — used by useLockViewport. */

function screenWidthPx(): string {
  const w = window.visualViewport?.width ?? window.innerWidth
  return `${Math.round(w)}px`
}

function screenHeightPx(): string {
  return `${Math.round(window.innerHeight)}px`
}

export function syncViewportLockDimensions(): void {
  if (typeof document === 'undefined') return

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
