import type { ReactNode } from 'react'
import { useGestureUi } from '../../hooks/useGestureUi'
import { useGesturePadChrome } from '../../lib/gesturePadChrome'

type Props = {
  children: ReactNode
}

/** Fullscreen camera point scorer shell. Layout in gesture-score.layout.css */
export function GestureScoreCourtShell({ children }: Props) {
  useGesturePadChrome()
  useGestureUi('court')

  return <div className="gesture-score-court">{children}</div>
}
