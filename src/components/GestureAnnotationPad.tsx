import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { analyzeGesture } from '../lib/gestureAnalysis'
import {
  appendGestureDebugEntry,
  clearGestureDebugLog,
  readGestureDebugLog,
  type GestureDebugEntry,
} from '../lib/gestureDebugLog'
import {
  captureGesture,
  clientToNormalized,
  drawGestureMarkers,
  drawGestureStroke,
  gestureCode,
  quadrantFromPoint,
  type CapturedGesture,
  type NormalizedPoint,
  type Quadrant,
} from '../lib/gestureCapture'
import {
  gestureHapticComplete,
  gestureHapticQuadrantChange,
  gestureHapticStart,
  quadrantHighlightClass,
} from '../lib/gestureFeedback'
import { GestureDebugLog } from './GestureDebugLog'
import { GesturePadFeedback } from './GesturePadFeedback'

type Props = {
  competitionId?: string
  gameNumber?: string
  onGesture?: (gesture: CapturedGesture) => void
}

const QUADRANT_LABELS: Quadrant[] = ['TL', 'TR', 'BL', 'BR']

export function GestureAnnotationPad({ competitionId, gameNumber, onGesture }: Props) {
  const padRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const pathRef = useRef<NormalizedPoint[]>([])
  const drawingRef = useRef(false)
  const activeQuadrantRef = useRef<Quadrant | null>(null)
  const startedAtRef = useRef(0)

  const [lastGesture, setLastGesture] = useState<CapturedGesture | null>(null)
  const [lastAnalysis, setLastAnalysis] = useState<ReturnType<typeof analyzeGesture> | null>(null)
  const [debugLog, setDebugLog] = useState<GestureDebugEntry[]>(() => readGestureDebugLog())
  const [showDebug, setShowDebug] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startQuadrant, setStartQuadrant] = useState<Quadrant | null>(null)
  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant | null>(null)
  const [liveCode, setLiveCode] = useState<string | null>(null)
  const [livePath, setLivePath] = useState<NormalizedPoint[]>([])

  const syncCanvasSize = useCallback(() => {
    const pad = padRef.current
    const canvas = canvasRef.current
    if (!pad || !canvas) return

    const rect = pad.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 5
    ctx.strokeStyle = '#1a1a1a'

    sizeRef.current = { width: rect.width, height: rect.height }
  }, [])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = sizeRef.current
    ctx.clearRect(0, 0, width, height)
    drawGestureStroke(ctx, pathRef.current, width, height)
    drawGestureMarkers(ctx, pathRef.current, width, height)
  }, [])

  const clearCanvas = useCallback(() => {
    pathRef.current = []
    redraw()
  }, [redraw])

  const resetLiveState = () => {
    setIsDrawing(false)
    setStartQuadrant(null)
    setActiveQuadrant(null)
    setLiveCode(null)
    setLivePath([])
    activeQuadrantRef.current = null
  }

  const updateLiveQuadrants = (point: NormalizedPoint, isStart: boolean) => {
    const quadrant = quadrantFromPoint(point)
    if (isStart) {
      setStartQuadrant(quadrant)
      setActiveQuadrant(quadrant)
      activeQuadrantRef.current = quadrant
      setLiveCode(gestureCode(quadrant, quadrant))
      return
    }

    const start = quadrantFromPoint(pathRef.current[0])
    setActiveQuadrant(quadrant)
    setLiveCode(gestureCode(start, quadrant))

    if (activeQuadrantRef.current && activeQuadrantRef.current !== quadrant) {
      gestureHapticQuadrantChange()
    }
    activeQuadrantRef.current = quadrant
  }

  useEffect(() => {
    syncCanvasSize()
    const pad = padRef.current
    if (!pad) return

    const observer = new ResizeObserver(() => syncCanvasSize())
    observer.observe(pad)
    return () => observer.disconnect()
  }, [syncCanvasSize])

  const pointerDown = (clientX: number, clientY: number) => {
    const pad = padRef.current
    if (!pad) return

    drawingRef.current = true
    startedAtRef.current = performance.now()
    setIsDrawing(true)
    gestureHapticStart()

    const point = clientToNormalized(clientX, clientY, pad.getBoundingClientRect())
    pathRef.current = [point]
    setLivePath([point])
    updateLiveQuadrants(point, true)
    redraw()
  }

  const pointerMove = (clientX: number, clientY: number) => {
    if (!drawingRef.current) return
    const pad = padRef.current
    if (!pad) return

    const point = clientToNormalized(clientX, clientY, pad.getBoundingClientRect())
    const last = pathRef.current[pathRef.current.length - 1]
    if (last && last.x === point.x && last.y === point.y) return

    pathRef.current.push(point)
    setLivePath([...pathRef.current])
    updateLiveQuadrants(point, false)
    redraw()
  }

  const pointerUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false

    const captured = captureGesture(pathRef.current)
    clearCanvas()
    resetLiveState()

    if (!captured) return

    const durationMs = performance.now() - startedAtRef.current
    const analysis = analyzeGesture(captured, durationMs)
    const entry = appendGestureDebugEntry(analysis, { competitionId, gameNumber })

    gestureHapticComplete()
    setLastGesture(captured)
    setLastAnalysis(analysis)
    setDebugLog((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, 120))
    setPulse(true)
    window.setTimeout(() => setPulse(false), 450)
    onGesture?.(captured)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={padRef}
        className="relative min-h-0 flex-1 touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pointerDown(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => pointerMove(e.clientX, e.clientY)}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          pointerUp()
        }}
        onPointerCancel={() => pointerUp()}
      >
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {QUADRANT_LABELS.map((label) => (
            <div
              key={label}
              className={`border border-brand-primary/25 transition-colors duration-75 ${quadrantHighlightClass(
                label,
                startQuadrant,
                activeQuadrant,
                isDrawing,
              )}`}
            >
              <span
                className={`block p-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  isDrawing && (label === startQuadrant || label === activeQuadrant)
                    ? 'text-brand-primary'
                    : 'text-brand-muted'
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-brand-primary/50" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-brand-primary/50" />
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>

      <GesturePadFeedback
        isDrawing={isDrawing}
        livePath={livePath}
        liveCode={liveCode}
        lastGesture={lastGesture}
        lastAnalysis={lastAnalysis}
        pulse={pulse}
        logCount={debugLog.length}
        onOpenLog={() => setShowDebug(true)}
      />

      {showDebug
        ? createPortal(
            <div className="fixed inset-0 z-[300] flex flex-col bg-brand-surface">
              <GestureDebugLog
                entries={debugLog}
                onClose={() => setShowDebug(false)}
                onClear={() => {
                  clearGestureDebugLog()
                  setDebugLog([])
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
