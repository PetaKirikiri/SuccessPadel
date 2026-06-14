import type { CourtPlayer } from '../lib/americanoSchedule'
import { playerKey } from '../lib/courtPositionSetup'
import { firstDisplayName } from '../lib/leaderboardEntries'
import {
  formatTennisPoint,
  isDeuce,
  type TennisScore,
} from '../lib/tennisScore'

type Props = {
  score: TennisScore
  embedded?: boolean
  gameLabel?: string
  matchElapsed?: string
  teamA?: [CourtPlayer | undefined, CourtPlayer | undefined]
  teamB?: [CourtPlayer | undefined, CourtPlayer | undefined]
  highlightPlayerKey?: string | null
}

function PlayerAvatar({ player, name }: { player: CourtPlayer; name: string }) {
  if (player.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/50 sm:h-9 sm:w-9"
      />
    )
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold sm:h-9 sm:w-9 sm:text-sm">
      {name[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

function SideChip({
  player,
  highlighted,
}: {
  player: CourtPlayer | undefined
  highlighted?: boolean
}) {
  if (!player?.name?.trim()) {
    return <div className="h-9 w-28 sm:h-10 sm:w-32" aria-hidden />
  }
  const name = firstDisplayName(player.name.trim())
  return (
    <div
      className={`flex h-9 w-28 min-w-0 items-center gap-1.5 truncate rounded-full border py-0.5 pl-2 pr-0.5 shadow-sm backdrop-blur-sm sm:h-10 sm:w-32 sm:pl-2.5 sm:pr-0.5 ${
        highlighted
          ? 'scoreboard-chip-blink border-amber-200/90 bg-amber-500/30 ring-2 ring-amber-200/90'
          : 'border-white/35 bg-black/45'
      }`}
    >
      <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-white sm:text-sm">
        {name}
      </span>
      <PlayerAvatar player={player} name={name} />
    </div>
  )
}

export function GesturePadScoreboard({
  score,
  embedded = false,
  gameLabel,
  matchElapsed,
  teamA,
  teamB,
  highlightPlayerKey,
}: Props) {
  const showChips = Boolean(teamA && teamB)
  const leftPoint = formatTennisPoint(score.pointsA)
  const rightPoint = formatTennisPoint(score.pointsB)
  const deuce = isDeuce(score)
  const chipHighlighted = (player: CourtPlayer | undefined) =>
    Boolean(player && highlightPlayerKey && playerKey(player) === highlightPlayerKey)

  return (
    <div
      className={`pointer-events-none flex min-w-0 flex-1 items-center justify-center gap-2 text-center sm:gap-3 ${
        embedded ? 'px-2 py-2 sm:px-3 sm:py-2.5' : 'rounded-xl border border-white/35 bg-black/45 px-3 py-3 shadow-sm backdrop-blur-sm sm:py-4'
      }`}
    >
      {showChips ? (
        <div className="flex shrink-0 flex-col items-end justify-center gap-1">
          <SideChip player={teamA![0]} highlighted={chipHighlighted(teamA![0])} />
          <SideChip player={teamA![1]} highlighted={chipHighlighted(teamA![1])} />
          <span className="pr-0.5 font-display text-base font-bold tabular-nums leading-none text-white/60 sm:text-lg">
            {score.gamesA}
          </span>
        </div>
      ) : (
        <span className="shrink-0 font-display text-base font-bold tabular-nums leading-none text-white/60 sm:text-lg">
          {score.gamesA}
        </span>
      )}

      <div className="relative z-[1] flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 sm:gap-1">
        <div className="flex items-baseline justify-center gap-1 sm:gap-1.5">
          <p className="font-display text-3xl font-bold leading-none tracking-wide text-white sm:text-4xl md:text-5xl">
            {leftPoint}
          </p>
          <span className="font-display text-3xl font-bold leading-none tracking-wide text-white/70 sm:text-4xl md:text-5xl">
            -
          </span>
          <p className="font-display text-3xl font-bold leading-none tracking-wide text-white sm:text-4xl md:text-5xl">
            {rightPoint}
          </p>
          {deuce ? (
            <span className="ml-0.5 text-sm font-bold leading-none text-amber-200 sm:text-base">
              GP
            </span>
          ) : null}
        </div>
        {matchElapsed ? (
          <p className="font-mono text-base font-semibold tabular-nums leading-none text-white/75 sm:text-lg md:text-xl">
            {matchElapsed}
          </p>
        ) : null}
        {gameLabel ? (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60 sm:text-[11px]">
            {gameLabel}
          </p>
        ) : null}
      </div>

      {showChips ? (
        <div className="flex shrink-0 flex-col items-start justify-center gap-1">
          <SideChip player={teamB![0]} highlighted={chipHighlighted(teamB![0])} />
          <SideChip player={teamB![1]} highlighted={chipHighlighted(teamB![1])} />
          <span className="pl-0.5 font-display text-base font-bold tabular-nums leading-none text-white/60 sm:text-lg">
            {score.gamesB}
          </span>
        </div>
      ) : (
        <span className="shrink-0 font-display text-base font-bold tabular-nums leading-none text-white/60 sm:text-lg">
          {score.gamesB}
        </span>
      )}
    </div>
  )
}
