import type { CourtPlayer } from '../lib/americanoSchedule'
import { firstDisplayName } from '../lib/leaderboardEntries'

function SideChip({ player }: { player: CourtPlayer | undefined }) {
  if (!player?.name?.trim()) {
    return <div className="h-12 w-36 sm:h-[3.25rem] sm:w-40" aria-hidden />
  }
  const name = firstDisplayName(player.name.trim())
  return (
    <div className="flex h-12 w-36 min-w-0 items-center gap-2 truncate rounded-full border border-white/35 bg-black/45 py-1 pl-1 pr-3 shadow-sm backdrop-blur-sm sm:h-[3.25rem] sm:w-40 sm:pr-3.5">
      {player.avatarUrl ? (
        <img
          src={player.avatarUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/50 sm:h-11 sm:w-11"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold sm:h-11 sm:w-11 sm:text-base">
          {name[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white sm:text-base">{name}</span>
    </div>
  )
}

type Props = {
  left: CourtPlayer | undefined
  right: CourtPlayer | undefined
  games: number
}

export function GesturePadTeamRail({ left, right, games }: Props) {
  return (
    <div className="pointer-events-none grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-1.5 sm:gap-4 sm:px-4">
      <div className="flex min-w-0 justify-start">
        <SideChip player={left} />
      </div>
      <p className="font-display text-2xl font-bold leading-none tabular-nums text-white sm:text-3xl">
        {games}
      </p>
      <div className="flex min-w-0 justify-end">
        <SideChip player={right} />
      </div>
    </div>
  )
}
