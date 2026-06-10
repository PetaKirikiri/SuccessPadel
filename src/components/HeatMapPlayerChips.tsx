import type { Quadrant } from '../lib/gestureCapture'
import { COURT_QUADRANTS } from '../lib/courtPositionSetup'
import type { QuadrantPlayers } from '../lib/gesturePadPlayers'
import { firstDisplayName } from '../lib/leaderboardEntries'

type Props = {
  players: QuadrantPlayers
  selected: Quadrant
  onSelect: (quadrant: Quadrant) => void
}

export function HeatMapPlayerChips({ players, selected, onSelect }: Props) {
  const slots = COURT_QUADRANTS.filter((q) => players[q]?.name?.trim())

  return (
    <div className="flex flex-wrap items-center gap-2">
      {slots.map((quadrant) => {
        const player = players[quadrant]!
        const name = firstDisplayName(player.name.trim())
        const active = quadrant === selected
        return (
          <button
            key={quadrant}
            type="button"
            onClick={() => onSelect(quadrant)}
            className={`flex min-w-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-semibold transition-colors ${
              active
                ? 'border-white bg-white text-[#11355c] shadow'
                : 'border-white/35 bg-black/40 text-white hover:bg-white/10'
            }`}
          >
            {player.avatarUrl ? (
              <img
                src={player.avatarUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/40"
              />
            ) : (
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active ? 'bg-[#11355c]/10 text-[#11355c]' : 'bg-white/15 text-white'
                }`}
              >
                {name[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <span className="min-w-0 max-w-[8rem] truncate">{name}</span>
          </button>
        )
      })}
    </div>
  )
}
