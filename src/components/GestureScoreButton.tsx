import { Camera } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { requestGestureScoreCamera, supportsGestureScoreCamera } from '../lib/gestureScoreCamera'

type Props = {
  dark: boolean
  className?: string
}

export function GestureScoreButton({ dark, className = '' }: Props) {
  const navigate = useNavigate()
  const openGestureScore = () => {
    if (supportsGestureScoreCamera()) {
      void requestGestureScoreCamera()
    }
    navigate('/gesture-score-test')
  }

  return (
    <button
      type="button"
      onClick={openGestureScore}
      aria-label="Gesture Score Test"
      title="Gesture Score Test"
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition md:h-11 md:w-11 ${
        dark
          ? 'border-white/35 bg-black/40 text-white hover:bg-white/10 active:bg-white/10'
          : 'border-brand-border bg-brand-surface text-brand-primary hover:bg-brand-bg-alt active:bg-brand-bg-alt'
      } ${className}`}
    >
      <Camera className={`h-4 w-4 shrink-0 md:h-5 md:w-5 ${dark ? 'text-sky-300' : 'text-brand-accent'}`} aria-hidden />
    </button>
  )
}
