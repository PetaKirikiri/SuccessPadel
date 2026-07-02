import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import type { GameLogPoint } from '../../lib/gameLogSerialize'
import { MANUAL_GAMES_GESTURE_ID } from '../../lib/gestureCameraScore'
import type { HoldUi } from '../../lib/gestureFingerDetect'
import { PlayerChip } from './PlayerChip'
import { formatGameScore, formatTennisPoint } from '../../lib/tennisScore'
import { cameraScoreTrackerRootClass } from './CameraScoreTracker.styles'

type HoldFinger = 'team1' | 'team2' | 'undo'

function FingerIcon({ count }: { count: 1 | 2 | 3 }) {
  const src =
    count === 1
      ? '/gesture-score/one-finger.png'
      : count === 2
        ? '/gesture-score/two-fingers.png'
        : '/gesture-score/three-fingers.png'
  return (
    <img
      src={src}
      alt=""
      className="gesture-score-court__finger-icon"
      aria-hidden
      draggable={false}
    />
  )
}

function FingerBtn({
  count,
  action,
  activeHold,
  holdProgress,
  preview,
  ariaLabel,
  className,
  disabled,
  onClick,
  label,
  labelAbove,
}: {
  count: 1 | 2 | 3
  action: HoldFinger
  activeHold: HoldFinger | null
  holdProgress: number
  preview?: boolean
  ariaLabel: string
  className: string
  disabled?: boolean
  onClick: () => void
  label?: string
  labelAbove?: boolean
}) {
  const lit = activeHold === action
  const seen = Boolean(preview && lit)
  const holding = Boolean(!preview && lit)
  const pct = holding ? `${Math.round(holdProgress * 100)}%` : '0%'
  const labelNode = label ? (
    <span className="gesture-score-court__finger-label">{label}</span>
  ) : null

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      data-seen={seen || undefined}
      data-holding={holding || undefined}
      style={preview ? undefined : ({ '--hold-pct': pct } as CSSProperties)}
      disabled={disabled}
      onClick={onClick}
    >
      {labelAbove ? labelNode : null}
      <FingerIcon count={count} />
      {!labelAbove ? labelNode : null}
    </button>
  )
}

function EditableGames({
  value,
  disabled,
  ariaLabel,
  onCommit,
}: {
  value: number
  disabled?: boolean
  ariaLabel: string
  onCommit: (games: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [editing, value])

  if (editing && !disabled) {
    return (
      <input
        type="number"
        inputMode="numeric"
        min={0}
        className="gesture-score-court__team-games gesture-score-court__team-games-edit"
        aria-label={ariaLabel}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setEditing(false)
          const parsed = Number.parseInt(draft, 10)
          if (!Number.isNaN(parsed) && parsed !== value) onCommit(parsed)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
          if (event.key === 'Escape') {
            setDraft(String(value))
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      className="gesture-score-court__team-games"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        setDraft(String(value))
        setEditing(true)
      }}
    >
      {value}
    </button>
  )
}

export type CameraScoreTrackerHandle = {
  setHold: (ui: HoldUi) => void
}

const EMPTY_HOLD: HoldUi = { activeHold: null, holdProgress: 0, gestureCooldown: false }

export type CameraScoreTrackerProps = {
  pointLeft: number
  pointRight: number
  gamesLeft: number
  gamesRight: number
  golden?: boolean
  isFinal?: boolean
  team1HasServe?: boolean
  team2HasServe?: boolean
  team1Players?: CourtPlayer[]
  team2Players?: CourtPlayer[]
  pointHistory?: GameLogPoint[]
  scoreDisabled?: boolean
  gamesEditDisabled?: boolean
  preview?: boolean
  cameraPreview?: ReactNode
  showStartCamera?: boolean
  cameraStarting?: boolean
  cameraError?: string | null
  cameraStatus?: 'idle' | 'loading' | 'running' | 'unsupported' | 'error'
  onStartCamera?: () => void
  onGamesLeftChange: (games: number) => void
  onGamesRightChange: (games: number) => void
  onTeam1: () => void
  onTeam2: () => void
  onUndo: () => void
}

export const CameraScoreTracker = forwardRef<CameraScoreTrackerHandle, CameraScoreTrackerProps>(
  function CameraScoreTracker(
    {
      pointLeft,
      pointRight,
      gamesLeft,
      gamesRight,
      golden,
      isFinal,
      team1HasServe,
      team2HasServe,
      team1Players,
      team2Players,
      pointHistory = [],
      scoreDisabled = false,
      gamesEditDisabled = false,
      preview = false,
      cameraPreview,
      showStartCamera = false,
      cameraStarting = false,
      cameraError = null,
      cameraStatus = 'idle',
      onStartCamera,
      onGamesLeftChange,
      onGamesRightChange,
      onTeam1,
      onTeam2,
      onUndo,
    },
    ref,
  ) {
    const [hold, setHold] = useState<HoldUi>(EMPTY_HOLD)
    useImperativeHandle(ref, () => ({ setHold }), [])
    const { activeHold, holdProgress } = hold

    useEffect(() => {
      if (preview) return
      const root = document.documentElement
      const camera = document.querySelector('.gesture-score-court__top-center .gesture-score-court__camera-preview')
      const games = document.querySelector('.gesture-score-court__team-games')
      const chips = document.querySelector('.gesture-score-court__team-chips')
      const cameraStyle = camera ? getComputedStyle(camera) : null
      const gamesStyle = games ? getComputedStyle(games) : null
      const chipsStyle = chips ? getComputedStyle(chips) : null
      // #region agent log
      fetch('http://127.0.0.1:7695/ingest/c4960c9b-f3c9-4190-b564-b1526039f3c6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '5d6061' },
        body: JSON.stringify({
          sessionId: '5d6061',
          runId: 'layout-probe',
          hypothesisId: 'H1-H5',
          location: 'CameraScoreTracker.tsx:mount',
          message: 'gesture court layout probe',
          data: {
            viewport: root.dataset.viewport ?? null,
            gestureUi: root.dataset.gestureUi ?? null,
            gamesLeft,
            gamesRight,
            hasGamesEl: Boolean(games),
            gamesDisplay: gamesStyle?.display ?? null,
            hasCameraInTopCenter: Boolean(camera),
            cameraPosition: cameraStyle?.position ?? null,
            cameraRight: cameraStyle?.right ?? null,
            chipsJustify: chipsStyle?.justifyContent ?? null,
            chipsWidth: chipsStyle?.width ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
    }, [gamesLeft, gamesRight, preview])

    const team1Header = useMemo(
      () => (
        <div className="gesture-score-court__team-score">
          {team1Players?.length ? (
            <div className="gesture-score-court__team-chips gesture-score-court__team-chips--large">
              <PlayerChip player={team1Players[0]} />
              <PlayerChip player={team1Players[1]} />
            </div>
          ) : null}
          <EditableGames
            value={gamesLeft}
            disabled={gamesEditDisabled}
            ariaLabel="Team 1 games — tap to edit"
            onCommit={onGamesLeftChange}
          />
          <div className="gesture-score-court__team-score-wrap">
            {team1HasServe ? <span className="gesture-score-court__serve">●</span> : null}
            <div className="gesture-score-court__team-point">{formatTennisPoint(pointLeft)}</div>
          </div>
        </div>
      ),
      [gamesEditDisabled, gamesLeft, onGamesLeftChange, pointLeft, team1HasServe, team1Players],
    )

    const team2Header = useMemo(
      () => (
        <div className="gesture-score-court__team-score">
          {team2Players?.length ? (
            <div className="gesture-score-court__team-chips gesture-score-court__team-chips--large">
              <PlayerChip player={team2Players[0]} />
              <PlayerChip player={team2Players[1]} />
            </div>
          ) : null}
          <EditableGames
            value={gamesRight}
            disabled={gamesEditDisabled}
            ariaLabel="Team 2 games — tap to edit"
            onCommit={onGamesRightChange}
          />
          <div className="gesture-score-court__team-score-wrap">
            {team2HasServe ? <span className="gesture-score-court__serve">●</span> : null}
            <div className="gesture-score-court__team-point">{formatTennisPoint(pointRight)}</div>
          </div>
        </div>
      ),
      [gamesEditDisabled, gamesRight, onGamesRightChange, pointRight, team2HasServe, team2Players],
    )

    const centerBadges = useMemo(
      () => (
        <>
          {golden ? <span className="gesture-score-court__badge">Golden</span> : null}
          {isFinal ? <span className="gesture-score-court__badge">Final</span> : null}
        </>
      ),
      [golden, isFinal],
    )

    const historyList = useMemo(() => {
      const rows = pointHistory.filter((point) => point.winnerGestureId !== MANUAL_GAMES_GESTURE_ID)
      if (rows.length === 0) return null
      return (
        <section className="gesture-score-court__history" aria-label="Score history">
          <ol className="gesture-score-court__history-list">
            {[...rows].reverse().map((point, index) => (
              <li
                key={`${point.at}-${index}`}
                className={`gesture-score-court__history-row gesture-score-court__history-row--${point.winner}`}
              >
                <span className="gesture-score-court__history-score">
                  {formatGameScore(point.scoreBefore ?? point.scoreAfter)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )
    }, [pointHistory])

    return (
      <main className={cameraScoreTrackerRootClass}>
        {preview ? (
          <p className="gesture-score-court__detect-banner">1 / 2 / 3 — on when camera sees that many fingers</p>
        ) : null}
        <section className="gesture-score-court__top" aria-label="Live score">
          <div className="gesture-score-court__team-header gesture-score-court__team-header--left">
            {team1Header}
          </div>

          <div className="gesture-score-court__top-center">
            {showStartCamera ? (
              <button
                type="button"
                className="gesture-score-court__start-camera"
                aria-label="Start camera for gesture scoring"
                disabled={cameraStarting}
                onClick={() => {
                  onStartCamera?.()
                }}
              >
                {cameraStarting ? 'Starting camera…' : 'Start camera'}
              </button>
            ) : null}
            {cameraPreview}
            {centerBadges}
          </div>

          <div className="gesture-score-court__team-header gesture-score-court__team-header--right">
            {team2Header}
          </div>
        </section>

        <div className="gesture-score-court__finger-row" aria-label="Gesture scoring controls">
          <FingerBtn
            count={1}
            action="team1"
            activeHold={activeHold}
            holdProgress={holdProgress}
            preview={preview}
            ariaLabel="Team 1 point"
            className="gesture-score-court__finger-btn gesture-score-court__finger-btn--team1"
            disabled={preview ? false : scoreDisabled}
            onClick={onTeam1}
          />
          <FingerBtn
            count={3}
            action="undo"
            activeHold={activeHold}
            holdProgress={holdProgress}
            preview={preview}
            ariaLabel="Undo last point"
            className="gesture-score-court__finger-btn gesture-score-court__finger-btn--undo"
            disabled={preview ? false : scoreDisabled}
            onClick={onUndo}
            label="Undo"
            labelAbove
          />
          <FingerBtn
            count={2}
            action="team2"
            activeHold={activeHold}
            holdProgress={holdProgress}
            preview={preview}
            ariaLabel="Team 2 point"
            className="gesture-score-court__finger-btn gesture-score-court__finger-btn--team2"
            disabled={preview ? false : scoreDisabled}
            onClick={onTeam2}
          />
        </div>

        {cameraError || cameraStatus === 'unsupported' ? (
          <p className="gesture-score-court__camera-error" role="alert">
            {cameraError ??
              'Camera access is not available from this page. Use HTTPS or open the production site.'}
          </p>
        ) : null}

        {historyList}
      </main>
    )
  },
)
