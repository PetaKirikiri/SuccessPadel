import { useNavigate, useParams } from 'react-router-dom'
import { AppTopBar } from '../components/AppTopBar'
import { GestureAnnotationPad } from '../components/GestureAnnotationPad'

export function GesturePadPage() {
  const navigate = useNavigate()
  const { id, gameNumber } = useParams()
  const gameLabel = gameNumber ? `Game ${gameNumber}` : 'Game'

  const goBack = () => {
    if (id) navigate(`/competitions/${id}`)
    else navigate(-1)
  }

  return (
    <div className="gesture-pad-page game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <AppTopBar className="shrink-0 border-b border-brand-border/60 py-3 portrait:flex landscape:hidden">
        <button
          type="button"
          onClick={goBack}
          className="shrink-0 text-sm font-medium text-brand-primary"
        >
          ← Back
        </button>
        <p className="min-w-0 flex-1 truncate text-center font-display text-base font-semibold text-brand-primary">
          {gameLabel} · Gesture Pad
        </p>
        <span className="w-12 shrink-0" aria-hidden />
      </AppTopBar>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={goBack}
          className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] z-10 hidden rounded-full border border-brand-border bg-brand-surface/90 px-3 py-1 text-xs font-medium text-brand-primary backdrop-blur-sm landscape:block"
        >
          ← Back
        </button>
        <GestureAnnotationPad competitionId={id} gameNumber={gameNumber} />
      </div>
    </div>
  )
}
