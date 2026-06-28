import type { ReactNode } from 'react'
import { useGestureUi } from '../../hooks/useGestureUi'
import { useGesturePadChrome } from '../../lib/gesturePadChrome'

type Props = {
  children: ReactNode
  dashboard?: ReactNode
}

/** Fullscreen gesture pad shell — no paper + dock. Layout in gesture-pad.layout.css */
export function GesturePadShell({ children, dashboard }: Props) {
  useGesturePadChrome()
  useGestureUi('pad')

  return (
    <div className="gesture-pad-page">
      <div className="gesture-pad-device">{children}</div>
      {dashboard}
    </div>
  )
}
