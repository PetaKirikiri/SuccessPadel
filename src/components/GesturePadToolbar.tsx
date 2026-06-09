import { useState } from 'react'
import { GestureHelpModal } from './GestureHelpModal'

const chromeBtn =
  'rounded-full border border-white/40 bg-black/35 text-sm font-semibold text-white backdrop-blur-sm'

type Props = {
  onBack: () => void
  backLabel: string
  competitionId?: string
  gameNumber?: string
}

export function GesturePadToolbar({ onBack, backLabel, competitionId, gameNumber }: Props) {
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <>
      <div className="pointer-events-none absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] z-20">
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <button type="button" onClick={onBack} className={`${chromeBtn} px-4 py-1.5`}>
            {backLabel}
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Gesture help"
            className={`${chromeBtn} flex h-9 w-9 items-center justify-center text-base font-bold`}
          >
            ?
          </button>
        </div>
      </div>
      {helpOpen ? (
        <GestureHelpModal
          onClose={() => setHelpOpen(false)}
          competitionId={competitionId}
          gameNumber={gameNumber}
        />
      ) : null}
    </>
  )
}
