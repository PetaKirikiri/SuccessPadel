import { useRef, useState, type RefObject } from 'react'
import type { CourtPlayer } from '../lib/americanoSchedule'
import {
  dropHalfFromClient,
  isCompleteAssignment,
  teamIsPlaced,
  teamsFromQuadrants,
  type CourtHalf,
  type CourtTeam,
} from '../lib/courtPositionSetup'
import type { Quadrant } from '../lib/gestureCapture'
import type { QuadrantPlayers } from '../lib/gesturePadPlayers'
import { firstDisplayName } from '../lib/leaderboardEntries'

const SLOT_POS: Record<Quadrant, string> = {
  TL: 'top-3 left-3 sm:top-4 sm:left-4',
  TR: 'top-3 right-3 sm:top-4 sm:right-4',
  BL: 'bottom-3 left-3 sm:bottom-4 sm:left-4',
  BR: 'bottom-3 right-3 sm:bottom-4 sm:right-4',
}

/** Centre-line column: one team group stacked above the other with spacing. */
function TeamChipGroup({
  team,
  players,
  padRef,
  onAssignTeam,
}: {
  team: CourtTeam
  players: [CourtPlayer, CourtPlayer]
  padRef: RefObject<HTMLDivElement | null>
  onAssignTeam: (team: CourtTeam, player: CourtPlayer, half: CourtHalf) => void
}) {
  return (
    <div className="flex flex-col items-stretch gap-1.5 rounded-2xl border border-white/25 bg-black/25 px-2 py-2 shadow-sm backdrop-blur-sm">
      {players.map((player) => (
        <DraggableNetChip
          key={player.id ?? player.name}
          player={player}
          team={team}
          padRef={padRef}
          onAssignTeam={onAssignTeam}
        />
      ))}
    </div>
  )
}

type Props = {
  quadrantPlayers: QuadrantPlayers
  roster: CourtPlayer[]
  assignments: Partial<QuadrantPlayers>
  padRef: RefObject<HTMLDivElement | null>
  onAssignTeam: (team: CourtTeam, player: CourtPlayer, half: CourtHalf) => void
  onConfirmPositions: () => void
}

function sideHint(player: CourtPlayer) {
  if (player.preferredSide) return null
  return (
    <span className="shrink-0 rounded bg-white/15 px-1 py-0.5 text-[10px] font-bold tracking-wide text-white/80">
      L · R
    </span>
  )
}

function PlayerChip({
  player,
  draggable,
  dragging,
  offset,
  locked,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  player: CourtPlayer
  draggable: boolean
  dragging: boolean
  offset: { x: number; y: number }
  locked?: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: (e: React.PointerEvent) => void
}) {
  const name = firstDisplayName(player.name.trim() || 'Player')
  return (
    <div
      className={`flex w-full max-w-full touch-none items-center gap-1.5 truncate rounded-full border py-0.5 pl-0.5 pr-2.5 shadow-sm backdrop-blur-sm sm:gap-2 sm:pr-3 ${
        locked
          ? 'pointer-events-none border-white/35 bg-black/45 ring-1 ring-white/25'
          : draggable
            ? 'cursor-grab border-white/50 bg-black/50 ring-1 ring-white/35 active:cursor-grabbing'
            : 'border-white/35 bg-black/40 opacity-60'
      } ${dragging ? 'z-20 scale-105 ring-2 ring-white/70' : 'z-10'}`}
      style={
        dragging
          ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
          : undefined
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {player.avatarUrl ? (
        <img
          src={player.avatarUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/50 sm:h-9 sm:w-9"
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold sm:h-9 sm:w-9 sm:text-sm">
          {name[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      <span className="truncate text-xs font-semibold text-white sm:text-sm">{name}</span>
      {sideHint(player)}
    </div>
  )
}

function DraggableNetChip({
  player,
  team,
  padRef,
  onAssignTeam,
}: {
  player: CourtPlayer
  team: CourtTeam
  padRef: RefObject<HTMLDivElement | null>
  onAssignTeam: (team: CourtTeam, player: CourtPlayer, half: CourtHalf) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const originRef = useRef<{ x: number; y: number } | null>(null)

  const finishDrag = (e: React.PointerEvent) => {
    if (!dragging) return
    e.stopPropagation()
    setDragging(false)
    setOffset({ x: 0, y: 0 })
    originRef.current = null

    const pad = padRef.current
    if (!pad) return
    const half = dropHalfFromClient(e.clientX, e.clientY, pad)
    onAssignTeam(team, player, half)
  }

  return (
    <PlayerChip
      player={player}
      draggable
      dragging={dragging}
      offset={offset}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        originRef.current = { x: e.clientX, y: e.clientY }
        setDragging(true)
      }}
      onPointerMove={(e) => {
        if (!dragging || !originRef.current) return
        e.stopPropagation()
        setOffset({
          x: e.clientX - originRef.current.x,
          y: e.clientY - originRef.current.y,
        })
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    />
  )
}

export function CourtPositionSetup({
  quadrantPlayers,
  roster,
  assignments,
  padRef,
  onAssignTeam,
  onConfirmPositions,
}: Props) {
  const { teamA, teamB } = teamsFromQuadrants(quadrantPlayers)
  const teamAPlaced = teamIsPlaced('a', assignments)
  const teamBPlaced = teamIsPlaced('b', assignments)
  const canStart = isCompleteAssignment(roster, assignments)
  const placedCount = (teamAPlaced ? 2 : 0) + (teamBPlaced ? 2 : 0)

  const hint = !teamAPlaced
    ? 'Drag a player to the left or right side'
    : !teamBPlaced
      ? 'Drag a player from the other team'
      : 'All players placed'

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[4] bg-black/30" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-[4] grid grid-cols-2">
        <div className="border-r border-dashed border-white/20" />
        <div />
      </div>
      {(['TL', 'TR', 'BL', 'BR'] as Quadrant[]).map((quadrant) => {
        const player = assignments[quadrant]
        if (!player?.name?.trim()) return null
        const alignRight = quadrant === 'TR' || quadrant === 'BR'
        return (
          <div
            key={`locked-${quadrant}`}
            className={`pointer-events-none absolute z-[5] flex ${SLOT_POS[quadrant]} ${alignRight ? 'justify-end' : 'justify-start'}`}
          >
            <PlayerChip
              player={player}
              draggable={false}
              dragging={false}
              offset={{ x: 0, y: 0 }}
              locked
              onPointerDown={() => {}}
              onPointerMove={() => {}}
              onPointerUp={() => {}}
              onPointerCancel={() => {}}
            />
          </div>
        )
      })}
      {!teamAPlaced || !teamBPlaced ? (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 z-[5] flex w-[min(52vw,13rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-stretch gap-5">
          {!teamAPlaced ? (
            <TeamChipGroup
              team="a"
              players={teamA}
              padRef={padRef}
              onAssignTeam={onAssignTeam}
            />
          ) : null}
          {!teamBPlaced ? (
            <TeamChipGroup
              team="b"
              players={teamB}
              padRef={padRef}
              onAssignTeam={onAssignTeam}
            />
          ) : null}
        </div>
      ) : null}
      <div className="pointer-events-auto absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[6] flex flex-col items-center gap-2 px-4">
        <p className="rounded-full bg-black/50 px-3 py-1 text-center text-xs font-medium text-white backdrop-blur-sm">
          {hint} ({placedCount}/4)
        </p>
        <button
          type="button"
          disabled={!canStart}
          onClick={onConfirmPositions}
          className="w-full max-w-xs rounded-xl bg-brand-accent px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          Confirm positions
        </button>
      </div>
    </>
  )
}
