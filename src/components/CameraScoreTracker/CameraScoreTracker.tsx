import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import type { GameLogPoint } from '../../lib/gameLogSerialize'
import { MANUAL_GAMES_GESTURE_ID } from '../../lib/gestureCameraScore'
import { type HoldUi } from '../../lib/gestureFingerDetect'
import { PlayerChip } from './PlayerChip'
import { formatGameScore, formatTennisPoint } from '../../lib/tennisScore'
import { cameraScoreTrackerRootClass } from './CameraScoreTracker.styles'

type HoldFinger = 'team1' | 'team2' | 'undo'
type TrackerSelectOption = {
  value: string
  label: string
  status?: 'available' | 'occupied' | 'mine'
}

function holdStyle(progress: number): CSSProperties {
  return { '--hold-progress': String(progress) } as CSSProperties
}

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
  gestureCooldown,
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
  gestureCooldown?: boolean
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
  const progress = holding ? holdProgress : 0
  const activate = () => {
    if (disabled) return
    onClick()
  }
  const labelNode = label ? (
    <span className="gesture-score-court__finger-label">{label}</span>
  ) : null

  const buttonStyle =
    preview || !holding
      ? ({ touchAction: 'manipulation' } as CSSProperties)
      : ({ ...holdStyle(progress), touchAction: 'manipulation' } as CSSProperties)

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      data-seen={seen || undefined}
      data-holding={holding || undefined}
      data-cooldown={gestureCooldown || undefined}
      style={buttonStyle}
      disabled={disabled}
      onClick={activate}
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

function optionStatusLabel(status: TrackerSelectOption['status']): string | null {
  if (status === 'available') return 'Available'
  if (status === 'occupied') return 'In use'
  if (status === 'mine') return 'Selected'
  return null
}

function GestureScoreNavigatorMenu({
  label,
  options,
  selectedValue,
  onChange,
}: {
  label: string
  options: TrackerSelectOption[]
  selectedValue?: string
  onChange?: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === selectedValue) ?? options[0]
  const selectedStatus = optionStatusLabel(selected?.status)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div
      ref={menuRef}
      className="gesture-score-court__navigator-menu"
      data-open={open || undefined}
    >
      <button
        type="button"
        className="gesture-score-court__navigator-button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-status={selected?.status}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="gesture-score-court__navigator-button-text">
          {selected?.label ?? label}
        </span>
        {selectedStatus ? (
          <span className="gesture-score-court__navigator-button-status">
            {selectedStatus}
          </span>
        ) : null}
        <span className="gesture-score-court__navigator-button-caret" aria-hidden />
      </button>
      {open ? (
        <div className="gesture-score-court__navigator-options" role="listbox" aria-label={label}>
          {options.map((option) => {
            const statusLabel = optionStatusLabel(option.status)
            const selectedOption = option.value === selected?.value
            const chooseOption = () => {
              setOpen(false)
              if (option.value !== selectedValue) onChange?.(option.value)
            }
            return (
              <button
                key={option.value}
                type="button"
                className="gesture-score-court__navigator-option"
                role="option"
                aria-selected={selectedOption}
                data-selected={selectedOption || undefined}
                data-status={option.status}
                onPointerDown={(event) => {
                  event.preventDefault()
                  chooseOption()
                }}
                onClick={chooseOption}
              >
                <span className="gesture-score-court__navigator-option-dot" aria-hidden />
                <span className="gesture-score-court__navigator-option-label">
                  {option.label}
                </span>
                {statusLabel ? (
                  <span className="gesture-score-court__navigator-option-status">
                    {statusLabel}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function GestureScoreCourtNavigator({
  gameLabel,
  courtLabel,
  gameOptions,
  selectedGame,
  onGameChange,
  courtOptions,
  selectedCourt,
  onCourtChange,
  timerLabel,
  timerValue,
  timerTimeLabel,
}: {
  gameLabel?: string
  courtLabel?: string
  gameOptions: TrackerSelectOption[]
  selectedGame?: string
  onGameChange?: (value: string) => void
  courtOptions: TrackerSelectOption[]
  selectedCourt?: string
  onCourtChange?: (value: string) => void
  timerLabel?: string
  timerValue?: string | null
  timerTimeLabel?: string
}) {
  return (
    <section className="gesture-score-court__navigator" aria-label="Court and game controls">
      <div className="gesture-score-court__navigator-controls">
        <div className="gesture-score-court__navigator-field">
          <span className="gesture-score-court__navigator-caption">Game</span>
          <GestureScoreNavigatorMenu
            label={gameLabel ?? 'Game'}
            options={gameOptions}
            selectedValue={selectedGame}
            onChange={onGameChange}
          />
        </div>
        <div className="gesture-score-court__navigator-field">
          <span className="gesture-score-court__navigator-caption">Court</span>
          <GestureScoreNavigatorMenu
            label={courtLabel ?? 'Court'}
            options={courtOptions}
            selectedValue={selectedCourt}
            onChange={onCourtChange}
          />
        </div>
      </div>
      <div className="gesture-score-court__navigator-timer" aria-live="polite">
        <span className="gesture-score-court__navigator-timer-label">{timerLabel}</span>
        <span className="gesture-score-court__navigator-timer-value">{timerValue ?? '--:--'}</span>
        {timerTimeLabel ? (
          <span className="gesture-score-court__navigator-timer-time">{timerTimeLabel}</span>
        ) : null}
      </div>
    </section>
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
  undoDisabled?: boolean
  gamesEditDisabled?: boolean
  preview?: boolean
  cameraPreview?: ReactNode
  showStartCamera?: boolean
  cameraStarting?: boolean
  cameraError?: string | null
  cameraStatus?: 'idle' | 'loading' | 'running' | 'unsupported' | 'error'
  gameLabel?: string
  courtLabel?: string
  gameOptions?: TrackerSelectOption[]
  selectedGame?: string
  onGameChange?: (value: string) => void
  courtOptions?: TrackerSelectOption[]
  selectedCourt?: string
  onCourtChange?: (value: string) => void
  timerLabel?: string
  timerValue?: string | null
  timerTimeLabel?: string
  onStartCamera?: () => void
  onStopCamera?: () => void
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
      undoDisabled = false,
      gamesEditDisabled = false,
      preview = false,
      cameraPreview,
      showStartCamera = false,
      cameraStarting = false,
      cameraError = null,
      cameraStatus = 'idle',
      gameLabel,
      courtLabel,
      gameOptions = [],
      selectedGame,
      onGameChange,
      courtOptions = [],
      selectedCourt,
      onCourtChange,
      timerLabel,
      timerValue,
      timerTimeLabel,
      onStartCamera,
      onStopCamera,
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
    const { activeHold, holdProgress, gestureCooldown } = hold

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
        <GestureScoreCourtNavigator
          gameLabel={gameLabel}
          courtLabel={courtLabel}
          gameOptions={gameOptions}
          selectedGame={selectedGame}
          onGameChange={onGameChange}
          courtOptions={courtOptions}
          selectedCourt={selectedCourt}
          onCourtChange={onCourtChange}
          timerLabel={timerLabel}
          timerValue={timerValue}
          timerTimeLabel={timerTimeLabel}
        />
        <section className="gesture-score-court__top" aria-label="Live score">
          <div className="gesture-score-court__team-header gesture-score-court__team-header--left">
            {team1Header}
          </div>

          <div className="gesture-score-court__top-center">
            {cameraPreview ? (
              <button
                type="button"
                className="gesture-score-court__camera-wrap"
                aria-label="Stop camera"
                onClick={() => {
                  if (cameraStatus === 'running' || cameraStatus === 'loading') onStopCamera?.()
                }}
              >
                {cameraPreview}
              </button>
            ) : null}
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
            gestureCooldown={gestureCooldown}
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
            gestureCooldown={gestureCooldown}
            preview={preview}
            ariaLabel="Undo last point"
            className="gesture-score-court__finger-btn gesture-score-court__finger-btn--undo"
            disabled={preview ? false : undoDisabled}
            onClick={onUndo}
            label="Undo"
            labelAbove
          />
          <FingerBtn
            count={2}
            action="team2"
            activeHold={activeHold}
            holdProgress={holdProgress}
            gestureCooldown={gestureCooldown}
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
