type MediaQueryChangeHandler = (event: MediaQueryListEvent) => void

export function listenToMediaQuery(
  mediaQuery: MediaQueryList,
  handler: MediaQueryChangeHandler,
): () => void {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }

  mediaQuery.addListener(handler)
  return () => mediaQuery.removeListener(handler)
}
