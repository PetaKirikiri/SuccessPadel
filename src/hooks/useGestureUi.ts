import { useEffect } from 'react'

export type GestureUiMode = 'pad' | 'court'

export function useGestureUi(mode: GestureUiMode | null): void {
  useEffect(() => {
    if (mode) document.documentElement.dataset.gestureUi = mode
    else delete document.documentElement.dataset.gestureUi
    return () => {
      delete document.documentElement.dataset.gestureUi
    }
  }, [mode])
}
