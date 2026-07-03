/** Single source for app viewport lock dimensions. */

export type ViewportOrientation = 'portrait' | 'landscape'

export type ViewportLockMetrics = {
  widthPx: number
  heightPx: number
  width: string
  height: string
  orientation: ViewportOrientation
}

function readViewportNumber(value: number | undefined): number {
  return Number.isFinite(value) && value != null ? value : 0
}

export function readViewportLockMetrics(): ViewportLockMetrics {
  const visualViewport = window.visualViewport
  const widthPx = Math.round(
    Math.max(
      window.innerWidth,
      readViewportNumber(visualViewport?.width),
      document.documentElement.clientWidth,
    ),
  )
  const heightPx = Math.round(
    Math.max(
      window.innerHeight,
      readViewportNumber(visualViewport?.height),
      document.documentElement.clientHeight,
    ),
  )
  const orientation: ViewportOrientation = widthPx > heightPx ? 'landscape' : 'portrait'

  return {
    widthPx,
    heightPx,
    width: `${widthPx}px`,
    height: `${heightPx}px`,
    orientation,
  }
}

export function syncViewportLockDimensions(metrics = readViewportLockMetrics()): void {
  if (typeof document === 'undefined') return

  const { width, height } = metrics
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
