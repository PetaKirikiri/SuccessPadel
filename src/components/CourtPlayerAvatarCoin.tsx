import type { CourtPlayer } from '../lib/americanoSchedule'
import { firstDisplayName } from '../lib/leaderboardEntries'

const SIZE = {
  md: 'h-11 w-11 text-sm sm:h-12 sm:w-12',
  lg: 'h-14 w-14 text-base sm:h-16 sm:w-16',
} as const

type Props = {
  player: CourtPlayer
  size?: keyof typeof SIZE
  highlighted?: boolean
  serving?: boolean
  /** Top court half — match serve coin crop (feet on service line). */
  topHalf?: boolean
}

export function CourtPlayerAvatarCoin({
  player,
  size = 'md',
  highlighted = false,
  serving = false,
  topHalf = false,
}: Props) {
  const name = firstDisplayName(player.name.trim() || '?')
  const ring = serving
    ? 'ring-2 ring-inset ring-white/50 gesture-serve-watermark-blink'
    : highlighted
      ? 'border-white bg-white ring-2 ring-white'
      : 'ring-2 ring-inset ring-white/50'
  const imgClass = topHalf ? 'object-bottom' : 'object-top'

  return (
    <div className={`pointer-events-none aspect-square shrink-0 ${SIZE[size]}`}>
      {player.avatarUrl ? (
        <div className={`relative h-full w-full overflow-hidden rounded-full ${ring}`}>
          <img src={player.avatarUrl} alt="" className={`h-full w-full object-cover ${imgClass}`} />
        </div>
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center rounded-full font-bold text-white ${ring} ${
            highlighted ? 'bg-[#11355c]/15 text-[#11355c]' : 'bg-white/20'
          }`}
        >
          {name[0]?.toUpperCase() ?? '?'}
        </span>
      )}
    </div>
  )
}
