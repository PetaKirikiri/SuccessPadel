import { useEffect, useState } from 'react'

export type DeviceClass = 'phone' | 'tablet' | 'web'

/** Touch input → tablet/phone; mouse/trackpad only → web (desktop). */
const TOUCH_QUERY = '(pointer: coarse)'
/** Shorter viewport edge (px) at/above which a touch device counts as tablet. */
const TABLET_SHORT_SIDE = 600

function isTouchDevice(): boolean {
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia(TOUCH_QUERY).matches
  }
  return false
}

function detectDeviceClass(): DeviceClass {
  if (typeof window === 'undefined') return 'phone'
  if (!isTouchDevice()) return 'web'
  const shortSide = Math.min(window.innerWidth, window.innerHeight)
  return shortSide >= TABLET_SHORT_SIDE ? 'tablet' : 'phone'
}

export function useDeviceClass(): DeviceClass {
  const [deviceClass, setDeviceClass] = useState<DeviceClass>(detectDeviceClass)

  useEffect(() => {
    const touch = window.matchMedia(TOUCH_QUERY)
    const update = () => setDeviceClass(detectDeviceClass())
    touch.addEventListener('change', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      touch.removeEventListener('change', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return deviceClass
}

function detectLandscape(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth > window.innerHeight
}

export function useIsLandscape(): boolean {
  const [landscape, setLandscape] = useState<boolean>(detectLandscape)

  useEffect(() => {
    const update = () => setLandscape(detectLandscape())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return landscape
}
