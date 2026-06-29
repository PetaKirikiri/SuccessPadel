import { forwardRef, useImperativeHandle, useMemo, useState, type CSSProperties } from 'react'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import type { GameLogPoint } from '../../lib/gameLogSerialize'
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
}) {
  const lit = activeHold === action
  const seen = Boolean(preview && lit)
  const holding = Boolean(!preview && lit)
  const pct = holding ? `${Math.round(holdProgress * 100)}%` : '0%'

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
      <FingerIcon count={count} />
      {label ? <span className="gesture-score-court__undo-label">{label}</span> : null}
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
  preview?: boolean
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
      preview = false,
      onTeam1,
      onTeam2,
      onUndo,
    },
    ref,
  ) {
    // Hold UI lives here so the camera engine's per-frame updates re-render only
    // this subtree, never the heavy GestureScoreCourtPage (realtime + board).
    const [hold, setHold] = useState<HoldUi>(EMPTY_HOLD)
    useImperativeHandle(ref, () => ({ setHold }), [])
    const { activeHold, holdProgress } = hold

    const team1Header = useMemo(
      () => (
        <>
          {team1Players?.length ? (
            <div className="gesture-score-court__team-chips gesture-score-court__team-chips--large">
              <PlayerChip player={team1Players[0]} />
              <PlayerChip player={team1Players[1]} />
            </div>
          ) : null}
          <div className="gesture-score-court__team-score">
            <div className="gesture-score-court__team-score-wrap">
              {team1HasServe ? <span className="gesture-score-court__serve">●</span> : null}
              <div className="gesture-score-court__team-point">{formatTennisPoint(pointLeft)}</div>
            </div>
            <div className="gesture-score-court__team-games">{gamesLeft}</div>
          </div>
        </>
      ),
      [team1Players, team1HasServe, pointLeft, gamesLeft],
    )

    const team2Header = useMemo(
      () => (
        <>
          {team2Players?.length ? (
            <div className="gesture-score-court__team-chips gesture-score-court__team-chips--large">
              <PlayerChip player={team2Players[0]} />
              <PlayerChip player={team2Players[1]} />
            </div>
          ) : null}
          <div className="gesture-score-court__team-score">
            <div className="gesture-score-court__team-score-wrap">
              {team2HasServe ? <span className="gesture-score-court__serve">●</span> : null}
              <div className="gesture-score-court__team-point">{formatTennisPoint(pointRight)}</div>
            </div>
            <div className="gesture-score-court__team-games">{gamesRight}</div>
          </div>
        </>
      ),
      [team2Players, team2HasServe, pointRight, gamesRight],
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
      if (pointHistory.length === 0) return null
      return (
        <section className="gesture-score-court__history" aria-label="Score history">
          <ol className="gesture-score-court__history-list">
            {[...pointHistory].reverse().map((point, index) => (
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
          </div>

          <div className="gesture-score-court__top-center">
            {centerBadges}
            <FingerBtn
              count={3}
              action="undo"
              activeHold={activeHold}
              holdProgress={holdProgress}
              preview={preview}
              ariaLabel="Undo last point"
              className="gesture-score-court__finger-btn gesture-score-court__finger-btn--undo"
              disabled={preview ? false : hold.gestureCooldown}
              onClick={onUndo}
              label="Undo"
            />
          </div>

          <div className="gesture-score-court__team-header gesture-score-court__team-header--right">
            {team2Header}
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
        </section>

        {historyList}
      </main>
    )
  },
)
