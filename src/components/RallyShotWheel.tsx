import { useCallback, useEffect, useRef, useState } from 'react'
import type { NormalizedPoint, Quadrant } from '../lib/gestureCapture'
import { debugSessionLog } from '../lib/debug/devDebug'
import {
  RALLY_SHOT_OPTIONS,
  RALLY_SHOT_RADIUS_PX,
  SHOT_WAVE_DISPLAY,
  angleDegFromClient,
  offsetToAngleDeg,
  rallyShotDefaultAngleDeg,
  rallyShotOffsetFromAngle,
  shotHasWave,
  shotWaveFromAngle,
  shotWaveWedges,
  type RallyShotPick,
  type RallyWheelShot,
  type ShotWaveOption,
} from '../lib/rallyShotWheel'
import { pct } from '../lib/padelCourtLayout'

/** Distance from the hub (px) the coin must be pulled out to anchor + open zones. */
const PULL_OUT_PX = RALLY_SHOT_RADIUS_PX + 30
/** Radius of the second-wave 4-zone ring drawn around the anchored coin. */
const ZONE_RING_RADIUS_PX = 52
/** Power = stretch distance from the coin: min (0 power) to max (full / capped). */
const POWER_MIN_FROM_COIN = 30
const POWER_MAX_FROM_COIN = 112
const POWER_SVG_RADIUS = POWER_MAX_FROM_COIN + 12

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Green (low) to red (max) for the power stretch. */
function powerColor(power: number): string {
  return `hsl(${Math.round(120 * (1 - power))}, 85%, 55%)`
}

function wedgePath(r: number, startDeg: number, endDeg: number): string {
  const a1 = (startDeg * Math.PI) / 180
  const a2 = (endDeg * Math.PI) / 180
  const x1 = Math.cos(a1) * r
  const y1 = Math.sin(a1) * r
  const x2 = Math.cos(a2) * r
  const y2 = Math.sin(a2) * r
  return `M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}

type Props = {
  anchor: NormalizedPoint
  quadrant: Quadrant
  role: 'attacker' | 'defender'
  selectedPick?: RallyShotPick
  wave?: ShotWaveOption
  power?: number
  interactive?: boolean
  onPick: (pick: RallyShotPick) => void
  onAngleChange: (angleDeg: number) => void
  onWaveChange?: (value: ShotWaveOption) => void
  onPowerChange?: (power: number) => void
  /** Tap the already-selected shot to clear it (restore the other options). */
  onDeselect?: () => void
}

/** Screen px of finger travel below which a press counts as a tap, not a drag. */
const TAP_MOVE_PX = 8

type DragState = {
  shot: RallyWheelShot
  angleDeg: number
  pointerId: number
  /** Locked racket angle once the coin is pulled out (second-wave). */
  lockedAngle: number | null
  /** Second-wave zone the finger is currently over while pulled out. */
  hoverWave: ShotWaveOption | null
  /** Shot power 0..1 from how far the coin is stretched out. */
  power: number
  /** Direction (deg) of the stretch from the coin center. */
  powerAngle: number
}

export function RallyShotWheel({
  anchor,
  quadrant,
  role,
  selectedPick,
  wave,
  power,
  interactive = true,
  onPick,
  onAngleChange,
  onWaveChange,
  onPowerChange,
  onDeselect,
}: Props) {
  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState<DragState | null>(null)
  const hubRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag
  const movedRef = useRef(false)
  const tapStartRef = useRef<{ x: number; y: number } | null>(null)

  const hubCenter = useCallback(() => {
    const hub = hubRef.current?.getBoundingClientRect()
    if (!hub) return null
    return { x: hub.left + hub.width / 2, y: hub.top + hub.height / 2 }
  }, [])

  const angleForShot = useCallback(
    (shot: RallyWheelShot): number => {
      if (drag?.shot === shot) return drag.angleDeg
      if (selectedPick?.shot === shot) return selectedPick.angleDeg
      return rallyShotDefaultAngleDeg(quadrant, shot)
    },
    [drag, quadrant, selectedPick],
  )

  const positionForShot = useCallback(
    (shot: RallyWheelShot) => rallyShotOffsetFromAngle(angleForShot(shot)),
    [angleForShot],
  )

  const measureGeometry = useCallback(
    (phase: string) => {
      const hub = hubRef.current
      if (!hub) return
      const hubRect = hub.getBoundingClientRect()
      const originX = hubRect.left + hubRect.width / 2
      const originY = hubRect.top + hubRect.height / 2
      const buttons = Array.from(hub.querySelectorAll<HTMLButtonElement>('[data-rally-shot]'))
      const buttonCenters = buttons.map((button) => {
        const rect = button.getBoundingClientRect()
        const shot = button.dataset.rallyShot as RallyWheelShot
        const expected = positionForShot(shot)
        const measured = {
          x: rect.left + rect.width / 2 - originX,
          y: rect.top + rect.height / 2 - originY,
        }
        return {
          shot,
          angleDeg: angleForShot(shot),
          expected,
          measured,
          onCircumference:
            Math.abs(Math.hypot(measured.x, measured.y) - RALLY_SHOT_RADIUS_PX) < 6,
        }
      })
      // #region agent log
      debugSessionLog(
        'RallyShotWheel.tsx:measureGeometry',
        'rally shot wheel geometry measured',
        {
          phase,
          runId: 'angle-drag',
          role,
          quadrant,
          selectedPick,
          buttonCenters,
        },
        'H8',
      )
      // #endregion
    },
    [angleForShot, positionForShot, quadrant, role, selectedPick],
  )

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setOpen(true)
      requestAnimationFrame(() => measureGeometry('open'))
    })
    return () => cancelAnimationFrame(id)
  }, [anchor.x, anchor.y, measureGeometry, quadrant, role])

  const endDrag = useCallback(() => {
    const active = dragRef.current
    if (!active) return
    const finalAngle = active.lockedAngle ?? active.angleDeg
    const tapped = !movedRef.current
    if (!selectedPick || selectedPick.shot !== active.shot) {
      onPick({ shot: active.shot, angleDeg: finalAngle })
    } else if (tapped && onDeselect) {
      // Re-tapping the picked shot clears it and restores the other options.
      onDeselect()
      setDrag(null)
      return
    } else {
      onAngleChange(finalAngle)
    }
    if (active.lockedAngle != null) {
      if (active.hoverWave) onWaveChange?.(active.hoverWave)
      onPowerChange?.(active.power)
    }
    setDrag(null)
    requestAnimationFrame(() => measureGeometry('drag-end'))
  }, [measureGeometry, onAngleChange, onDeselect, onPowerChange, onWaveChange, onPick, selectedPick])

  const updateDrag = useCallback(
    (clientX: number, clientY: number) => {
      const center = hubCenter()
      const cur = dragRef.current
      if (!center || !cur) return
      if (!movedRef.current && tapStartRef.current) {
        const travel = Math.hypot(
          clientX - tapStartRef.current.x,
          clientY - tapStartRef.current.y,
        )
        if (travel > TAP_MOVE_PX) movedRef.current = true
      }
      const dx = clientX - center.x
      const dy = clientY - center.y
      const dist = Math.hypot(dx, dy)
      const angleDeg = offsetToAngleDeg(dx, dy)

      // Second-wave: pull the coin out past the threshold to anchor the racket
      // angle and pick from the 4 zones around the coin.
      if (shotHasWave(cur.shot) && (cur.lockedAngle != null || dist > PULL_OUT_PX)) {
        const lockedAngle = cur.lockedAngle ?? angleDeg
        const coin = rallyShotOffsetFromAngle(lockedAngle)
        const pdx = dx - coin.x
        const pdy = dy - coin.y
        const powerAngle = offsetToAngleDeg(pdx, pdy)
        const hoverWave = shotWaveFromAngle(cur.shot, powerAngle)
        const distFromCoin = Math.hypot(pdx, pdy)
        const power = clamp01(
          (distFromCoin - POWER_MIN_FROM_COIN) /
            (POWER_MAX_FROM_COIN - POWER_MIN_FROM_COIN),
        )
        setDrag((prev) =>
          prev ? { ...prev, angleDeg: lockedAngle, lockedAngle, hoverWave, power, powerAngle } : prev,
        )
        if (selectedPick?.shot === cur.shot) onAngleChange(lockedAngle)
        return
      }

      setDrag((prev) => (prev ? { ...prev, angleDeg, hoverWave: null } : prev))
      if (selectedPick?.shot === cur.shot) onAngleChange(angleDeg)
    },
    [hubCenter, onAngleChange, selectedPick?.shot],
  )

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragRef.current?.pointerId) return
      updateDrag(e.clientX, e.clientY)
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== dragRef.current?.pointerId) return
      endDrag()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [drag, endDrag, updateDrag])

  const startDrag = (shot: RallyWheelShot, e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    movedRef.current = false
    tapStartRef.current = { x: e.clientX, y: e.clientY }
    const center = hubCenter()
    const angleDeg = center
      ? angleDegFromClient(center.x, center.y, e.clientX, e.clientY)
      : rallyShotDefaultAngleDeg(quadrant, shot)
    setDrag({
      shot,
      angleDeg,
      pointerId: e.pointerId,
      lockedAngle: null,
      hoverWave: null,
      power: 0,
      powerAngle: 0,
    })
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const pulledOut = drag != null && drag.lockedAngle != null
  const zoneWedges = pulledOut ? shotWaveWedges(drag!.shot) : null
  const zoneCoin = pulledOut ? rallyShotOffsetFromAngle(drag!.lockedAngle!) : null

  return (
    <div
      data-rally-wheel={role}
      className="pointer-events-none absolute z-[6]"
      style={{ left: pct(anchor.x), top: pct(anchor.y) }}
    >
      <div
        ref={hubRef}
        className={`relative touch-none ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        {zoneCoin && zoneWedges ? (
          <svg
            width={POWER_SVG_RADIUS * 2}
            height={POWER_SVG_RADIUS * 2}
            viewBox={`${-POWER_SVG_RADIUS} ${-POWER_SVG_RADIUS} ${
              POWER_SVG_RADIUS * 2
            } ${POWER_SVG_RADIUS * 2}`}
            className="pointer-events-none absolute z-[1]"
            style={{ left: zoneCoin.x, top: zoneCoin.y, transform: 'translate(-50%, -50%)' }}
            aria-hidden
          >
            {zoneWedges.map((wedge) => {
              const active = (drag?.hoverWave ?? wave) === wedge.value
              const labelR = ZONE_RING_RADIUS_PX * 0.62
              const rad = (wedge.midDeg * Math.PI) / 180
              return (
                <g key={`${wedge.value}-${wedge.midDeg}`}>
                  <path
                    d={wedgePath(ZONE_RING_RADIUS_PX, wedge.startDeg, wedge.endDeg)}
                    fill={active ? 'rgba(251,191,36,0.9)' : 'rgba(8,28,52,0.8)'}
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth={1}
                  />
                  <text
                    x={Math.cos(rad) * labelR}
                    y={Math.sin(rad) * labelR}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="select-none"
                    fontSize={8.5}
                    fontWeight={700}
                    fill={active ? '#11355c' : '#ffffff'}
                  >
                    {SHOT_WAVE_DISPLAY[wedge.value]}
                  </text>
                </g>
              )
            })}
            {(() => {
              const p = drag?.power ?? power ?? 0
              const len = POWER_MIN_FROM_COIN + p * (POWER_MAX_FROM_COIN - POWER_MIN_FROM_COIN)
              const rad = ((drag?.powerAngle ?? 0) * Math.PI) / 180
              const hx = Math.cos(rad) * len
              const hy = Math.sin(rad) * len
              const color = powerColor(p)
              return (
                <g>
                  <line
                    x1={0}
                    y1={0}
                    x2={hx}
                    y2={hy}
                    stroke={color}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <circle cx={hx} cy={hy} r={8} fill={color} stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
                  <text
                    x={hx}
                    y={hy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="select-none"
                    fontSize={7.5}
                    fontWeight={700}
                    fill="#0b1f33"
                  >
                    {Math.round(p * 100)}
                  </text>
                </g>
              )
            })()}
          </svg>
        ) : null}
        <svg
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          aria-hidden
        >
          <circle
            cx={0}
            cy={0}
            r={RALLY_SHOT_RADIUS_PX}
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1.5}
            style={{ opacity: open ? 1 : 0 }}
          />
          {RALLY_SHOT_OPTIONS.map((shot, i) => {
            const { x, y } = positionForShot(shot)
            const picked = selectedPick?.shot === shot
            const active = picked || drag?.shot === shot
            return (
              <line
                key={shot}
                data-rally-line={shot}
                x1={0}
                y1={0}
                x2={x}
                y2={y}
                stroke={active ? 'rgba(251,191,36,0.85)' : 'rgba(255,255,255,0.5)'}
                strokeWidth={active ? 2 : 1.5}
                style={{
                  opacity: open ? (active ? 0.9 : 0.45) : 0,
                  transition: `opacity 200ms ease ${i * 30}ms`,
                }}
              />
            )
          })}
        </svg>

        {RALLY_SHOT_OPTIONS.map((shot, i) => {
          const { x, y } = positionForShot(shot)
          const picked = selectedPick?.shot === shot
          const dragging = drag?.shot === shot
          return (
            <button
              key={shot}
              type="button"
              data-rally-shot={shot}
              className={`absolute flex h-11 w-11 items-center justify-center rounded-full border text-xs font-bold shadow-lg transition-opacity touch-none ${
                picked || dragging
                  ? 'z-[2] cursor-grab border-amber-300 bg-amber-500 text-white active:cursor-grabbing'
                  : 'cursor-grab border-white/40 bg-black/70 text-white hover:bg-amber-500/90 active:cursor-grabbing'
              }`}
              style={{
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)',
                transitionDelay: dragging ? '0ms' : `${i * 30}ms`,
                opacity: open ? 1 : 0,
              }}
              onPointerDown={(e) => startDrag(shot, e)}
            >
              {shot}
            </button>
          )
        })}
      </div>
    </div>
  )
}
