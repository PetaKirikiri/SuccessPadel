import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { clientToPadNormalized, type NormalizedPoint, type Quadrant } from '../lib/gestureCapture'
import type { QuadrantPlayers } from '../lib/gesturePadPlayers'
import { firstDisplayName } from '../lib/leaderboardEntries'
import {
  gestureAttackerFill,
  gestureAttackerRing,
  gestureDefenderFill,
  gestureDefenderRing,
} from '../lib/gestureRoleColors'
import {
  measureCourtInset,
  padNormToCourtNorm,
  pct,
  type CourtInsetBounds,
  type CourtLayout,
} from '../lib/padelCourtLayout'
import { quadrantTeam } from '../lib/gestureScoring'
import {
  serveFormationCoinPlacement,
  clampPadPointToServerBox,
} from '../lib/serveRotation'
import type { MatchTeam } from '../lib/types'

const QUADRANTS: Quadrant[] = ['TL', 'TR', 'BL', 'BR']

export const QUADRANT_ANCHOR: Record<Quadrant, NormalizedPoint> = {
  TL: { x: 0.25, y: 0.25 },
  TR: { x: 0.75, y: 0.25 },
  BL: { x: 0.25, y: 0.75 },
  BR: { x: 0.75, y: 0.75 },
}

export type ShotOriginLock = {
  actorQuadrant: Quadrant
  origin: NormalizedPoint
}

type Props = {
  players: QuadrantPlayers
  padRef: RefObject<HTMLDivElement | null>
  rotatePad: boolean
  coinPlacements: Partial<Record<Quadrant, NormalizedPoint>>
  activeOrigin: ShotOriginLock | null
  servingQuadrant: Quadrant | null
  servePlayerQuadrant?: Quadrant | null
  serveSideQuadrant?: Quadrant | null
  servePending?: boolean
  serveAttempt?: 1 | 2 | null
  attackerQuadrant?: Quadrant | null
  defenderQuadrant?: Quadrant | null
  draggableQuadrant?: Quadrant | null
  draggableTeam?: MatchTeam | null
  /** When true, all coins are display-only (e.g. glass second stroke). */
  freezeCoins?: boolean
  courtLayout?: CourtLayout
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  onDragActiveChange: (active: boolean) => void
  onOriginMove?: (quadrant: Quadrant, origin: NormalizedPoint) => void
  onLockOrigin: (quadrant: Quadrant, origin: NormalizedPoint) => void
}

export function useCourtInset(padRef: RefObject<HTMLDivElement | null>): CourtInsetBounds | null {
  const [inset, setInset] = useState<CourtInsetBounds | null>(null)

  useEffect(() => {
    const pad = padRef.current
    if (!pad) return

    const measure = () => setInset(measureCourtInset(pad))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(pad)
    return () => ro.disconnect()
  }, [padRef])

  return inset
}

function resolveCoinCourtPosition(
  label: Quadrant,
  coinPlacements: Partial<Record<Quadrant, NormalizedPoint>>,
  inset: CourtInsetBounds | null,
  layout: CourtLayout = 'portrait',
): NormalizedPoint {
  if (coinPlacements[label] && inset) {
    return padNormToCourtNorm(coinPlacements[label]!, inset, layout)
  }
  return QUADRANT_ANCHOR[label]
}

function DraggableCoin({
  quadrant,
  player,
  padRef,
  rotatePad,
  courtLayout,
  courtPosition,
  courtInset,
  serviceLinePlacement,
  serveDragSide,
  servePending,
  serveAttempt,
  shotPickRole,
  isActive,
  serving,
  draggable,
  currentUserId,
  currentUserAvatarUrl,
  onDragActiveChange,
  onOriginMove,
  onLockOrigin,
}: {
  quadrant: Quadrant
  player: NonNullable<QuadrantPlayers[Quadrant]>
  padRef: RefObject<HTMLDivElement | null>
  rotatePad: boolean
  courtLayout: CourtLayout
  courtPosition: NormalizedPoint
  courtInset: CourtInsetBounds | null
  serviceLinePlacement: { left: string; top: string; transform: string } | null
  serveDragSide: Quadrant | null
  servePending: boolean
  serveAttempt?: 1 | 2 | null
  shotPickRole?: 'attacker' | 'defender' | null
  isActive: boolean
  serving: boolean
  draggable: boolean
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  onDragActiveChange: (active: boolean) => void
  onOriginMove?: (quadrant: Quadrant, origin: NormalizedPoint) => void
  onLockOrigin: (quadrant: Quadrant, origin: NormalizedPoint) => void
}) {
  const { t } = useTranslation()
  const [dragging, setDragging] = useState(false)
  const [ghostPadPoint, setGhostPadPoint] = useState<NormalizedPoint | null>(null)
  const draggingRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)

  const isCurrent = Boolean(currentUserId && player.id === currentUserId)
  const avatarUrl = player.avatarUrl ?? (isCurrent ? currentUserAvatarUrl : null)
  const name = firstDisplayName(player.name?.trim() || 'Player')

  const placementStyle = serviceLinePlacement ?? {
    left: pct(courtPosition.x),
    top: pct(courtPosition.y),
    transform: 'translate(-50%, -50%)',
  }

  const ghostCourtPoint =
    ghostPadPoint && courtInset
      ? padNormToCourtNorm(ghostPadPoint, courtInset, courtLayout)
      : ghostPadPoint

  const updateGhost = useCallback(
    (clientX: number, clientY: number) => {
      const pad = padRef.current
      if (!pad) return
      let pt = clientToPadNormalized(clientX, clientY, pad, rotatePad)
      if (serveDragSide && courtInset) {
        pt = clampPadPointToServerBox(pt, serveDragSide, courtInset, courtLayout)
      }
      setGhostPadPoint(pt)
      onOriginMove?.(quadrant, pt)
    },
    [courtInset, courtLayout, onOriginMove, padRef, quadrant, rotatePad, serveDragSide],
  )

  const padPointFromClient = useCallback(
    (clientX: number, clientY: number): NormalizedPoint | null => {
      const pad = padRef.current
      if (!pad) return null
      let pt = clientToPadNormalized(clientX, clientY, pad, rotatePad)
      if (serveDragSide && courtInset) {
        pt = clampPadPointToServerBox(pt, serveDragSide, courtInset, courtLayout)
      }
      return pt
    },
    [courtInset, courtLayout, padRef, rotatePad, serveDragSide],
  )

  const endDrag = useCallback(
    (clientX: number, clientY: number, cancelled: boolean) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      pointerIdRef.current = null
      setDragging(false)
      setGhostPadPoint(null)
      onDragActiveChange(false)

      if (cancelled) return

      const pad = padRef.current
      if (!pad) return
      const rect = pad.getBoundingClientRect()
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return
      }
      const pt = padPointFromClient(clientX, clientY)
      if (!pt) return
      onLockOrigin(quadrant, pt)
    },
    [onDragActiveChange, onLockOrigin, padPointFromClient, quadrant],
  )

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => {
      if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return
      updateGhost(e.clientX, e.clientY)
    }
    const onUp = (e: PointerEvent) => {
      if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return
      endDrag(e.clientX, e.clientY, false)
    }
    const onCancel = (e: PointerEvent) => {
      if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return
      endDrag(e.clientX, e.clientY, true)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [dragging, endDrag, updateGhost])

  const coinRing = shotPickRole
    ? shotPickRole === 'attacker'
      ? gestureAttackerRing
      : gestureDefenderRing
    : servePending
      ? isActive
        ? 'ring-[3px] ring-inset ring-emerald-300'
        : serving
          ? 'ring-2 ring-inset ring-white/50 gesture-serve-watermark-blink'
          : 'ring-2 ring-inset ring-white/50'
      : isActive
        ? 'ring-[3px] ring-inset ring-emerald-300'
        : 'ring-2 ring-white/60'

  const shotPickTint =
    shotPickRole === 'attacker'
      ? gestureAttackerFill
      : shotPickRole === 'defender'
        ? gestureDefenderFill
        : ''

  const coinSizeClass = 'h-11 w-11 text-sm sm:h-12 sm:w-12'

  const topHalfLine = quadrant === 'TL' || quadrant === 'TR'
  const imgObjectClass = serviceLinePlacement
    ? topHalfLine
      ? 'object-bottom'
      : 'object-top'
    : 'object-cover'

  const coinBody = (
    <div className={`aspect-square shrink-0 ${coinSizeClass}`}>
      {avatarUrl ? (
        <div className={`relative h-full w-full overflow-hidden rounded-full ${coinRing}`}>
          <img src={avatarUrl} alt="" className={`h-full w-full object-cover ${imgObjectClass}`} />
          {shotPickTint ? (
            <div className={`pointer-events-none absolute inset-0 rounded-full ${shotPickTint}`} />
          ) : null}
        </div>
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center rounded-full font-bold text-white ${coinRing} ${
            shotPickTint || 'bg-white/20'
          }`}
        >
          {name[0]?.toUpperCase() ?? '?'}
        </span>
      )}
    </div>
  )

  return (
    <>
      {draggable && dragging && ghostCourtPoint ? (
        <div
          className="pointer-events-none absolute z-[10]"
          style={{
            left: pct(ghostCourtPoint.x),
            top: pct(ghostCourtPoint.y),
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className={`aspect-square ${coinSizeClass}`}>
            {avatarUrl ? (
              <div className="h-full w-full overflow-hidden rounded-full ring-4 ring-amber-300">
                <img src={avatarUrl} alt="" className="h-full w-full object-cover object-bottom" />
              </div>
            ) : (
              <span className="flex h-full w-full items-center justify-center rounded-full bg-amber-400/40 text-sm font-bold text-white ring-4 ring-amber-300">
                {name[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </div>
        </div>
      ) : null}
      <div className={`absolute ${draggable ? 'z-[7]' : 'z-[5]'}`} style={placementStyle}>
        <div className="relative">
          {draggable ? (
            <button
              type="button"
              data-player-coin={quadrant}
              aria-label={name}
              className={`pointer-events-auto touch-manipulation cursor-grab rounded-full border-0 bg-transparent p-0 active:cursor-grabbing ${
                dragging ? 'opacity-0' : 'opacity-90'
              }`}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                pointerIdRef.current = e.pointerId
                draggingRef.current = true
                setDragging(true)
                updateGhost(e.clientX, e.clientY)
                onDragActiveChange(true)
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
            >
              {coinBody}
            </button>
          ) : (
            <div data-player-coin={quadrant} className="pointer-events-none opacity-90" aria-hidden>
              {coinBody}
            </div>
          )}
          {serveAttempt && serving ? (
            <span
              data-serve-attempt={serveAttempt}
              data-serve-label={quadrant}
              className="pointer-events-none absolute bottom-full left-1/2 z-[6] mb-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-white/80 sm:text-xs"
            >
              {serveAttempt === 2 ? t('pad.serve.secondServe') : t('pad.serve.firstServe')}
            </span>
          ) : null}
        </div>
      </div>
    </>
  )
}

export function PlayerShotOriginDrag({
  players,
  padRef,
  rotatePad,
  coinPlacements,
  activeOrigin,
  servingQuadrant,
  servePlayerQuadrant = null,
  serveSideQuadrant = null,
  servePending = false,
  serveAttempt = null,
  attackerQuadrant = null,
  defenderQuadrant = null,
  draggableQuadrant = null,
  draggableTeam = null,
  freezeCoins = false,
  courtLayout = 'portrait',
  currentUserId,
  currentUserAvatarUrl,
  onDragActiveChange,
  onOriginMove,
  onLockOrigin,
}: Props) {
  const courtInset = useCourtInset(padRef)

  return (
    <div className="pointer-events-none absolute inset-0">
      {QUADRANTS.map((label) => {
        const player = players[label]
        if (!player) return null
        const draggable = freezeCoins
          ? false
          : draggableQuadrant
            ? label === draggableQuadrant
            : servePending
              ? false
              : draggableTeam
                ? quadrantTeam(label) === draggableTeam
                : true
        const isServePosition =
          servePending && servePlayerQuadrant === label && serveSideQuadrant != null
        const serveDragSide =
          isServePosition && serveSideQuadrant ? serveSideQuadrant : null
        const serviceLinePlacement =
          servePending &&
          !coinPlacements[label] &&
          servePlayerQuadrant &&
          serveSideQuadrant
            ? serveFormationCoinPlacement(label, servePlayerQuadrant, serveSideQuadrant)
            : null
        return (
          <DraggableCoin
            key={`coin-${label}`}
            quadrant={label}
            player={player}
            padRef={padRef}
            rotatePad={rotatePad}
            courtLayout={courtLayout}
            courtPosition={resolveCoinCourtPosition(label, coinPlacements, courtInset, courtLayout)}
            courtInset={courtInset}
            serviceLinePlacement={serviceLinePlacement}
            serveDragSide={serveDragSide}
            servePending={servePending}
            serveAttempt={serveAttempt}
            shotPickRole={
              label === attackerQuadrant
                ? 'attacker'
                : label === defenderQuadrant
                  ? 'defender'
                  : null
            }
            isActive={activeOrigin?.actorQuadrant === label}
            serving={servingQuadrant === label}
            draggable={draggable}
            currentUserId={currentUserId}
            currentUserAvatarUrl={currentUserAvatarUrl}
            onDragActiveChange={onDragActiveChange}
            onOriginMove={draggableQuadrant === label ? onOriginMove : undefined}
            onLockOrigin={onLockOrigin}
          />
        )
      })}
    </div>
  )
}
