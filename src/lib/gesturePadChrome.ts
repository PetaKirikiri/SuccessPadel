import { createContext, useContext, useEffect } from 'react'

export function isGesturePadRoute(pathname: string): boolean {
  return /\/gesture-pad\/?$/.test(pathname) || /\/friendly\/[^/]+\/pad\/?$/.test(pathname)
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
