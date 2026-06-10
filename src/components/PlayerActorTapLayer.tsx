import type { Quadrant } from '../lib/gestureCapture'
import type { QuadrantPlayers } from '../lib/gesturePadPlayers'
import { firstDisplayName } from '../lib/leaderboardEntries'

const QUADRANTS: Quadrant[] = ['TL', 'TR', 'BL', 'BR']

type Props = {
  players: QuadrantPlayers
  selected: Quadrant | null
  servingQuadrant: Quadrant | null
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  onSelect: (quadrant: Quadrant) => void
}

export function PlayerActorTapLayer({
  players,
  selected,
  servingQuadrant,
  currentUserId,
  currentUserAvatarUrl,
  onSelect,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 grid grid-cols-2 grid-rows-2">
      {QUADRANTS.map((label) => {
        const player = players[label]
        if (!player) return <div key={`actor-${label}`} />
        const isCurrent = Boolean(currentUserId && player.id === currentUserId)
        const avatarUrl = player.avatarUrl ?? (isCurrent ? currentUserAvatarUrl : null)
        const isServing = servingQuadrant === label
        const isSelected = selected === label
        const name = firstDisplayName(player.name?.trim() || 'Player')
        return (
          <div
            key={`actor-${label}`}
            className="pointer-events-none flex flex-col items-center justify-center gap-1.5"
          >
            <button
              type="button"
              aria-pressed={isSelected}
              className={`pointer-events-auto flex flex-col items-center gap-1.5 touch-manipulation rounded-lg p-1 ${
                isSelected ? 'cursor-default' : 'cursor-pointer'
              }`}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onSelect(label)
              }}
            >
              {avatarUrl ? (
                <div
                  className={`aspect-square w-[min(40%,10rem)] shrink-0 overflow-hidden rounded-full ${
                    isSelected
                      ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-[#1a5fa8]'
                      : isServing
                        ? 'gesture-serve-watermark-blink'
                        : 'gesture-quadrant-watermark'
                  }`}
                >
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                </div>
              ) : (
                <span
                  className={`flex aspect-square w-[min(40%,10rem)] items-center justify-center rounded-full text-lg font-bold ${
                    isSelected
                      ? 'bg-amber-400/30 ring-4 ring-amber-300 text-white'
                      : 'bg-white/15 text-white/90'
                  }`}
                >
                  {name[0]?.toUpperCase() ?? '?'}
                </span>
              )}
              <span
                className={`max-w-[80%] truncate text-center text-sm font-semibold ${
                  isSelected
                    ? 'text-amber-200'
                    : isServing
                      ? 'text-amber-200'
                      : isCurrent
                        ? 'text-white'
                        : 'text-white/80'
                }`}
              >
                {name}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
