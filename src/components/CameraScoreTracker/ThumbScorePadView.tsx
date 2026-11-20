import { useRef, type RefObject } from 'react'
import { ShutterRemote } from './ShutterRemote'
import './courtScoreDisplay.css'
import type { EngineStatus } from '../../lib/gestureFingerDetect'
import { RECOGNITION_ZOOMS, type RecognitionZoom } from '../../lib/gestureRecognitionZoom'

function pointDisplay(points: number): string {
  return ['0', '15', '30', '40'][Math.min(points, 3)] ?? '40'
}

function PointDigits({ points, question }: { points: number; question?: boolean }) {
  const value = question ? '?' : pointDisplay(points)
  // Fit the visible Arial Bold numerals, excluding the font's ascender and descender space.
  return <svg className="court-score-display__digits" aria-hidden="true"
    viewBox="0 -73 95 75" preserveAspectRatio="xMidYMid meet">
    <text x="50%" y="0" textAnchor="middle">{value}</text>
  </svg>
}

function GameTotal({ games, label }: { games: number; label: string }) {
  return <span aria-label={`${label} games ${games}`}>
    <svg aria-hidden="true" viewBox="0 0 156 100" className="court-score-display__total">
      <text x="78" y="80" textAnchor="middle">{games}</text>
    </svg>
  </span>
}

type Props = {
  clicker?: boolean
  serving?: 'us' | 'them' | null
  remoteScope: string
  onRemote: (ours: boolean, subtract: boolean) => void
  zoom?: RecognitionZoom
  onZoomChange?: (zoom: RecognitionZoom) => void
  zoomCanvasRef?: RefObject<HTMLCanvasElement | null>
  videoRef?: RefObject<HTMLVideoElement | null>
  status?: EngineStatus
  error?: string | null
  ourPoints: number
  theirPoints: number
  ourGames: number
  theirGames: number
  timerValue: string
  onWin: () => void
  onLose: () => void
  onUndo: () => void
  onReset?: () => void
  undoDisabled?: boolean
  restartCamera?: () => void
  goBack: () => void
}

export function ThumbScorePadView({ clicker, serving, onRemote, remoteScope, videoRef, status, error, ourPoints, theirPoints,
  ourGames, theirGames, timerValue, onWin, onLose, onUndo, onReset,
  undoDisabled = false, restartCamera, goBack, zoom = 1, onZoomChange, zoomCanvasRef }: Props) {
  const controls = useRef<HTMLDialogElement>(null)
  const choosing = clicker && serving === null
  const odd = (ourPoints + theirPoints) % 2 === 1
  const corner = serving === 'us'
    ? (odd ? 'top-left' : 'bottom-left')
    : (odd ? 'top-right' : 'bottom-right')
  return (
    <main data-recognition-zoom={zoom} className="court-score-display" aria-label="Clicker scoreboard">
      {videoRef && <video ref={videoRef} muted playsInline className="court-score-display__sensor" aria-hidden="true" />}
      {zoomCanvasRef && <canvas ref={zoomCanvasRef} className="court-score-display__sensor" aria-hidden="true" />}
      <section hidden={choosing} className="court-score-display__games" aria-label="Games">
        <GameTotal games={ourGames} label="Our" />
        <GameTotal games={theirGames} label="Other" />
      </section>
      {choosing && <h1 className="clicker-question">Who is serving?</h1>}
      {clicker && serving && <span className="clicker-corner" data-corner={corner} role="img" aria-label={`Serving corner: ${corner}`} />}
      {!clicker && serving !== undefined && <div role="status" className="court-score-display__serve" data-side={serving}>{serving ? '● Serving' : 'Tap the team serving first'}</div>}
      <section className="court-score-display__points" aria-label="Current points">
        <button type="button" onClick={onWin} aria-label={choosing ? "Left team serves first" : `Our points ${pointDisplay(ourPoints)}. Add one point`}><PointDigits question={choosing} points={ourPoints} /></button>
        <button type="button" onClick={onLose} aria-label={choosing ? "Right team serves first" : `Other points ${pointDisplay(theirPoints)}. Add one point`}><PointDigits question={choosing} points={theirPoints} /></button>
      </section>
      <button data-setup={choosing || undefined} className="court-score-display__time" type="button" onClick={() => controls.current?.showModal()}
        aria-label={`Time ${timerValue}. Open scorer controls`} title="Open scorer controls"><span>{choosing ? '⚙' : timerValue}</span></button>
      <dialog ref={controls} className="court-score-controls" aria-label="Scorer controls">
        <button type="button" autoFocus onClick={() => controls.current?.close()}>Back to score</button>
        <ShutterRemote key={remoteScope} scope={remoteScope} clicker={clicker} onAction={onRemote} />
        <button type="button" disabled={undoDisabled} onClick={onUndo}>Undo last point</button>
        {onReset && <button type="button" onClick={onReset}>Reset practice score</button>}
        {onZoomChange && <fieldset><legend>Camera zoom</legend>{RECOGNITION_ZOOMS.map(value =>
          <button key={value} aria-label={`Recognition zoom ${value}×`} type="button" aria-pressed={zoom === value} onClick={() => onZoomChange(value)}>{value}×</button>
        )}</fieldset>}
        {restartCamera && status !== 'running' && <button type="button" onClick={restartCamera}>Start camera</button>}
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={goBack}>Leave scorer</button>
      </dialog>
    </main>
  )
}
