import { useLayoutEffect } from 'react'

function hasScrollableAxis(element: HTMLElement) {
  const style = window.getComputedStyle(element)
  const verticalOverflow = [style.overflowY, style.overflow].some((value) =>
    ['auto', 'scroll', 'overlay'].includes(value),
  )
  const horizontalOverflow = [style.overflowX, style.overflow].some((value) =>
    ['auto', 'scroll', 'overlay'].includes(value),
  )

  return (
    (verticalOverflow && element.scrollHeight > element.clientHeight + 1) ||
    (horizontalOverflow && element.scrollWidth > element.clientWidth + 1)
  )
}

function shouldAllowTouchMove(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (target.closest('[data-scroll-y]')) return true

  let element: Element | null = target
  while (element && element !== document.body && element !== document.documentElement) {
    if (element instanceof HTMLElement && hasScrollableAxis(element)) return true
    element = element.parentElement
  }

  return false
}

function blockDocumentScroll(e: TouchEvent) {
  if (shouldAllowTouchMove(e.target)) return
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
