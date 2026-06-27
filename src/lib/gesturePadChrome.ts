import { createContext, useContext, useEffect } from 'react'

export function isGesturePadRoute(pathname: string): boolean {
  return (
    /\/gesture-pad\/?$/.test(pathname) ||
    /\/gesture-score\/?$/.test(pathname) ||
    /\/gesture-score-test\/?$/.test(pathname) ||
    /\/dev\/gesture-score-test\/?$/.test(pathname) ||
    /\/live-court\/?$/.test(pathname) ||
    /\/friendly\/[^/]+\/(pad|heatmap)\/?$/.test(pathname) ||
    /\/friendly\/[^/]+\/games\/[^/]+\/courts\/[^/]+\/?$/.test(pathname) ||
    /^\/practice\/?$/.test(pathname)
  )
}

export const GesturePadChromeContext = createContext<((active: boolean) => void) | null>(null)

export function useGesturePadChrome(): void {
  const setActive = useContext(GesturePadChromeContext)

  useEffect(() => {
    if (!setActive) return
    setActive(true)
    return () => setActive(false)
  }, [setActive])
}
