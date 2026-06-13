import { createPortal } from 'react-dom'
import { LinePlayerLinkPanel } from './LinePlayerLinkPanel'

type Props = {
  competitionId: string | null
  padelPlayerId: string
  playerName: string
  onClose: () => void
}

export function LinePlayerLinkModal({
  competitionId,
  padelPlayerId,
  playerName,
  onClose,
}: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        data-scroll-y
        className="login-panel scroll-y flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-brand-border/60 bg-brand-surface shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <LinePlayerLinkPanel
          competitionId={competitionId}
          padelPlayerId={padelPlayerId}
          playerName={playerName}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  )
}
