import type { ReactNode } from 'react'
import { useGestureUi } from '../../hooks/useGestureUi'
import { useGesturePadChrome } from '../../lib/gesturePadChrome'

type Props = {
  children: ReactNode
  onSurfacePointerDown?: () => void
}

/** Fullscreen camera point scorer shell. Layout in gesture-score.layout.css */
export function CameraScoreTrackerShell({ children, onSurfacePointerDown }: Props) {
  useGesturePadChrome()
  useGestureUi('court')

  return (
    <div className="gesture-score-court" onPointerDownCapture={onSurfacePointerDown}>
      {children}
    </div>
  )
}
