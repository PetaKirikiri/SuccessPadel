import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronsUpDown } from 'lucide-react'
import { displayCourtLabel } from '../../lib/courtDisplay'
import type { TranslateFn } from '../../i18n'
import type { AmericanoScoringUnit } from '../../lib/competitionPresets'
import { bumpScoreField, scoreDigitsOnly } from '../../lib/competitionScoreInput'
import { compactDisplayNames } from '../../lib/leaderboardEntries'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import type { GameCardSize } from '../../lib/viewBreakpoints'
import { isTvSize } from './gameCardSizes'
import { warmupGestureScoreCamera } from '../../lib/gestureScoreCamera'
import { ScoreTrackerIcon } from '../../shared/Button/ScoreTrackerIcon'
import { PlayerAvatarLink } from '../../shared/ProfilePhoto/PlayerAvatarLink'
import { PlayerNameLink } from '../../shared/ProfilePhoto/PlayerNameLink'
import { debugSessionLog } from '../../lib/debug/devDebug'
import { GENDER_CHIP_COLORS } from '../../foundation/profile/profileFormUi'
import type { LiveCourt, ScoringGameCourt } from './gameBoardTypes'

export function stopCardNav(e: { stopPropagation: () => void }) {
  e.stopPropagation()
}

/** Gesture-scoring entry button. */
function CourtGestureScoreButton({
  href,
  live = false,
  ariaLabel = 'Live gesture scoring',
  variant = 'icon',
  label,
  showLabel = false,
}: {
  href: string
  live?: boolean
  ariaLabel?: string
  variant?: 'icon' | 'bar'
  label?: string
  showLabel?: boolean
}) {
  const onPress = (e: { stopPropagation: () => void }) => {
    stopCardNav(e)
    warmupGestureScoreCamera()
  }

  if (variant === 'bar') {
    return (
      <Link
        to={href}
        aria-label={ariaLabel}
        onClick={onPress}
        onPointerDown={stopCardNav}
        className="relative flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-brand-accent/50 bg-brand-accent/10 px-4 py-2.5 text-sm font-bold text-brand-accent shadow-sm transition active:scale-[0.98] dark:border-brand-accent/40 dark:bg-brand-accent/15 dark:text-brand-accent-light"
      >
        <ScoreTrackerIcon className="h-5 w-5 shrink-0" />
        <span>{label ?? ariaLabel}</span>
      </Link>
    )
  }

  return (
    <Link
      to={href}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onPress}
      onPointerDown={stopCardNav}
      className={`relative flex shrink-0 items-center justify-center rounded-full border border-brand-accent/40 bg-brand-bg-alt text-brand-accent shadow-sm transition active:scale-95 dark:border-brand-accent/35 dark:bg-white/10 dark:text-brand-accent-light ${
        showLabel ? 'h-8 gap-1 px-2' : 'h-8 w-8'
      }`}
    >
      <ScoreTrackerIcon className="h-4 w-4 shrink-0" />
      {showLabel ? (
        <span className="max-w-[4.5rem] truncate text-[10px] font-bold uppercase leading-none">
          {label ?? 'Score'}
        </span>
      ) : null}
      {live ? (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-surface bg-emerald-400 dark:border-[#0b2a4a]"
          aria-hidden
        />
      ) : null}
    </Link>
  )
}

/** Manual score-entry button — opens the stepper page. */
function CourtManualScoreButton({
  href,
  ariaLabel = 'Manual score entry',
}: {
  href: string
  ariaLabel?: string
}) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={(e) => {
        e.stopPropagation()
        navigate(href)
      }}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-accent/40 bg-brand-bg-alt text-brand-accent shadow-sm transition active:scale-95 dark:border-brand-accent/35 dark:bg-white/10 dark:text-brand-accent-light"
    >
      <ChevronsUpDown className="h-4 w-4" strokeWidth={2.25} aria-hidden />
    </button>
  )
}

/** Live-court (on-court shot pad) was removed — there is no live href. */
export function courtLiveHref(_props: {
  liveCourtEnabled: boolean
  friendly: boolean
  sessionId?: string
  competitionId?: string
  gameNumber: number
  courtLabel: string
  courtId?: string
  canEditScores: boolean
}): string | undefined {
  return undefined
}

function scoreFieldLabel(scoreUnit: AmericanoScoringUnit, t: TranslateFn): string {
  if (scoreUnit === 'sets') return t('competition.scoreSets')
  if (scoreUnit === 'open') return t('competition.scoreOpen')
  if (scoreUnit === 'games') return t('competition.scoreGames')
  return t('competition.scorePts')
}

export function courtGestureScoreHref({
  gestureScoreEnabled,
  friendly,
  sessionId,
  competitionId,
  gameNumber,
  courtLabel,
  courtId,
  currentUserId: _currentUserId,
  currentUserDisplayName: _currentUserDisplayName,
  court: _court,
  finished: _finished,
}: {
  gestureScoreEnabled: boolean
  friendly: boolean
  sessionId?: string
  competitionId?: string
  gameNumber: number
  courtLabel: string
  courtId?: string
  currentUserId?: string | null
  currentUserDisplayName?: string | null
  court: {
    playerIds?: string[]
    teamAPlayers?: CourtPlayer[]
    teamBPlayers?: CourtPlayer[]
    teamA?: string[]
    teamB?: string[]
  }
  finished: boolean
}): string | undefined {
  if (!gestureScoreEnabled || !sessionId) return undefined
  if (friendly) {
    return `/friendly/${sessionId}/games/${gameNumber}/courts/${encodeURIComponent(courtLabel)}/gesture-score`
  }
  if (competitionId && courtId) {
    return `/competitions/${competitionId}/games/${gameNumber}/courts/${courtId}/gesture-score`
  }
  return undefined
}

export function courtManualScoreHref({
  manualScoreEnabled,
  friendly,
  sessionId,
  gameNumber,
  courtLabel,
  finished,
  currentUserId: _currentUserId,
}: {
  manualScoreEnabled: boolean
  friendly: boolean
  sessionId?: string
  gameNumber: number
  courtLabel: string
  finished: boolean
  currentUserId?: string | null
}): string | undefined {
  if (!manualScoreEnabled || finished || !sessionId || !friendly) return undefined
  return `/friendly/${sessionId}/games/${gameNumber}/courts/${encodeURIComponent(courtLabel)}/manual-score`
}

export function isCurrentCourtPlayer(
  player: Pick<CourtPlayer, 'id' | 'name'>,
  currentUserId?: string | null,
  currentUserDisplayName?: string | null,
): boolean {
  if (currentUserId && player.id === currentUserId) return true
  const mine = currentUserDisplayName?.trim().toLocaleLowerCase()
  if (!mine) return false
  return player.name.trim().toLocaleLowerCase() === mine
}

export function courtHasCurrentUser(
  currentUserId: string | null | undefined,
  court: {
    playerIds?: string[]
    teamAPlayers?: CourtPlayer[]
    teamBPlayers?: CourtPlayer[]
    teamA?: string[]
    teamB?: string[]
  },
  currentUserDisplayName?: string | null,
): boolean {
  const players = [...(court.teamAPlayers ?? []), ...(court.teamBPlayers ?? [])]
  if (players.some((player) => isCurrentCourtPlayer(player, currentUserId, currentUserDisplayName))) {
    return true
  }
  if (currentUserId && court.playerIds?.includes(currentUserId)) return true
  const name = currentUserDisplayName?.trim().toLocaleLowerCase()
  if (!name) return false
  const courtNames = [...(court.teamA ?? []), ...(court.teamB ?? [])]
  return courtNames.some((courtName) => courtName.trim().toLocaleLowerCase() === name)
}

const COURT_LABEL_CLASS =
  'text-center font-display text-lg font-bold text-brand-accent dark:text-brand-tan md:text-xl'

function courtLabelClass(finished = false) {
  return finished
    ? 'text-center font-display text-lg font-bold text-brand-sage dark:text-brand-muted md:text-xl'
    : COURT_LABEL_CLASS
}

function courtCardShellClass({ finished }: { finished: boolean }) {
  const parts = [
    'game-card-court-shell w-full min-w-0 overflow-hidden rounded-xl border-2 bg-brand-surface shadow-[0_6px_18px_-8px_rgba(96,45,36,0.28)] transition dark:border-white/15 dark:bg-white/[0.06] dark:shadow-none',
  ]
  if (finished) {
    parts.push(
      'border-brand-border/50 bg-[#faf9f8] shadow-[0_2px_8px_-6px_rgba(96,45,36,0.15)] dark:border-white/12 dark:bg-white/[0.04] dark:shadow-none',
    )
  } else {
    parts.push('border-brand-primary/35 dark:border-brand-accent/30')
  }
  return parts.join(' ')
}

export function CourtCard({
  courtLabel,
  currentUserId: _currentUserId,
  currentUserDisplayName: _currentUserDisplayName,
  court,
  finished,
  href,
  gestureScoreHref,
  gestureScoreLive = false,
  manualScoreHref,
  size = 'mobile',
  fillCell = false,
  children,
  t,
}: {
  courtLabel: string
  currentUserId?: string | null
  currentUserDisplayName?: string | null
  court: LiveCourt | ScoringGameCourt
  finished: boolean
  href?: string
  gestureScoreHref?: string
  gestureScoreLive?: boolean
  manualScoreHref?: string
  size?: GameCardSize
  fillCell?: boolean
  children: ReactNode
  t: TranslateFn
}) {
  const navigate = useNavigate()
  const tv = isTvSize(size)
  const gridCell = fillCell || tv
  const shellClass = `${courtCardShellClass({ finished })}${
    gridCell ? ' game-card-court-card tv-court-card' : ''
  }${
    href
      ? ' cursor-pointer transition hover:border-brand-accent/45 active:scale-[0.99] active:opacity-95'
      : ''
  }`
  const body = (
    <>
      <div
        className={`game-card-court-header border-b ${
          finished
            ? 'border-brand-border/40 bg-brand-surface dark:bg-white/[0.03]'
            : 'border-brand-border/50 bg-brand-surface dark:bg-white/[0.04]'
        }`}
        onClick={href ? stopCardNav : undefined}
        onPointerDown={href ? stopCardNav : undefined}
      >
        <CourtLabelRow
          courtLabel={courtLabel}
          court={court}
          finished={finished}
          gestureScoreHref={gestureScoreHref}
          gestureScoreLive={gestureScoreLive}
          manualScoreHref={manualScoreHref}
          size={size}
          fillCell={gridCell}
          t={t}
        />
      </div>
      <div
        className={
            gridCell
            ? 'game-card-court-card-body tv-court-card-body flex min-h-0 flex-1 flex-col p-1.5'
            : 'game-card-court-card-body p-2 md:p-2.5'
        }
        onClick={href ? stopCardNav : undefined}
        onKeyDown={href ? stopCardNav : undefined}
      >
        {children}
      </div>
    </>
  )

  if (href) {
    return (
      <article
        className={shellClass}
        role="link"
        tabIndex={0}
        aria-label={t('court.openLiveCourt', { name: displayCourtLabel(courtLabel, t) })}
        onClick={() => navigate(href)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate(href)
          }
        }}
      >
        {body}
      </article>
    )
  }

  return <article className={shellClass}>{body}</article>
}

export function ScoreStepper({
  value,
  onChange,
  disabled,
  finished,
  ariaLabel,
  scoreMax,
  tv = false,
  hideSteps = false,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  finished?: boolean
  ariaLabel: string
  scoreMax?: number
  tv?: boolean
  hideSteps?: boolean
}) {
  const inputClass = tv
    ? finished
      ? 'h-11 w-12 rounded-xl border-2 border-brand-border/70 bg-brand-bg-alt px-1 py-0.5 text-center text-xl font-extrabold tabular-nums text-brand-primary shadow-sm disabled:text-brand-primary dark:border-white/20 dark:bg-white/[0.12] dark:text-brand-text'
      : 'h-11 w-12 rounded-xl border-2 border-brand-primary/55 bg-brand-bg-alt px-1 py-0.5 text-center text-xl font-extrabold tabular-nums text-brand-primary shadow-md placeholder:text-brand-muted/60 disabled:text-brand-primary dark:border-brand-accent/60 dark:bg-white/10 dark:text-brand-accent-light'
    : finished
      ? 'h-8 w-8 rounded-lg border border-brand-border/50 bg-[#faf9f7] px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-brand-sage disabled:text-brand-muted/60 dark:border-white/15 dark:bg-white/[0.08] dark:text-brand-text md:h-10 md:w-10 md:text-base'
      : 'h-8 w-8 rounded-lg border border-brand-border/80 bg-brand-surface px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-brand-primary disabled:text-brand-muted/60 dark:border-white/20 dark:bg-white/[0.08] dark:text-brand-text md:h-10 md:w-10 md:text-base'
  const stepClass = tv
    ? 'tv-score-step-btn flex h-6 w-12 items-center justify-center rounded-lg text-sm font-extrabold leading-none text-brand-primary active:bg-brand-bg-alt disabled:opacity-30 dark:text-brand-text dark:active:bg-white/10'
    : 'tv-score-step-btn flex h-5 w-8 items-center justify-center rounded text-[10px] font-bold leading-none text-brand-muted active:bg-brand-bg-alt disabled:opacity-30 dark:active:bg-white/10 md:h-6 md:w-10 md:text-xs'

  return (
    <div
      className={`flex flex-col items-center gap-0.5${tv ? ' tv-score-stepper' : ''}`}
      onClick={stopCardNav}
      onKeyDown={stopCardNav}
    >
      {!hideSteps ? (
        <button
          type="button"
          disabled={disabled}
          aria-label={`Increase ${ariaLabel}`}
          className={stepClass}
          onClick={() => onChange(bumpScoreField(value, 1, scoreMax))}
        >
          ▲
        </button>
      ) : null}
      <input
        type="text"
        inputMode={hideSteps ? 'text' : 'numeric'}
        pattern={hideSteps ? undefined : '[0-9]*'}
        value={value}
        placeholder="0"
        disabled={disabled}
        onChange={(e) => onChange(scoreDigitsOnly(e.target.value))}
        onFocus={(e) => {
          e.currentTarget.select()
          e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }}
        className={`tv-score-input ${inputClass}`}
        aria-label={ariaLabel}
      />
      {!hideSteps ? (
        <button
          type="button"
          disabled={disabled}
          aria-label={`Decrease ${ariaLabel}`}
          className={stepClass}
          onClick={() => onChange(bumpScoreField(value, -1, scoreMax))}
        >
          ▼
        </button>
      ) : null}
    </div>
  )
}

export function CourtTvScorePanel({
  teamAStr,
  teamBStr,
  onScoreA,
  onScoreB,
  onSubmit,
  canEdit,
  canSubmit,
  busy,
  finished,
  scoreMax,
  errorMessage,
  t,
}: {
  teamAStr: string
  teamBStr: string
  onScoreA: (v: string) => void
  onScoreB: (v: string) => void
  onSubmit: () => void
  canEdit: boolean
  canSubmit: boolean
  busy: boolean
  finished?: boolean
  scoreMax?: number
  errorMessage?: string | null
  t: TranslateFn
}) {
  return (
    <div
      className="flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-brand-accent/25 bg-brand-primary/95 px-2 py-2 shadow-inner dark:border-brand-accent/35 dark:bg-white/[0.08]"
      onClick={stopCardNav}
      onKeyDown={stopCardNav}
    >
      <div className="flex items-center justify-center gap-2">
        <ScoreStepper
          value={teamAStr}
          onChange={onScoreA}
          disabled={!canEdit}
          finished={finished}
          ariaLabel={t('aria.teamAScore', { unit: 'pts' })}
          scoreMax={scoreMax}
          tv
        />
        <ScoreStepper
          value={teamBStr}
          onChange={onScoreB}
          disabled={!canEdit}
          finished={finished}
          ariaLabel={t('aria.teamBScore', { unit: 'pts' })}
          scoreMax={scoreMax}
          tv
        />
      </div>
      <button
        type="button"
        disabled={!canSubmit || busy}
        onClick={(e) => {
          e.stopPropagation()
          onSubmit()
        }}
        className="h-9 w-full rounded-lg border border-[#7dd3fc]/50 bg-[#7dd3fc]/15 px-2 font-display text-xs font-black uppercase tracking-wide text-[#7dd3fc] shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
      >
        {busy ? t('common.loading') : t('common.submit')}
      </button>
      {errorMessage ? (
        <p className="max-w-full text-center text-[10px] font-semibold leading-tight text-red-300">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}

function CourtScoreButton({
  value,
  onOpen,
  disabled,
  finished,
  ariaLabel,
}: {
  value: string
  onOpen?: () => void
  disabled?: boolean
  finished?: boolean
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      disabled={disabled || !onOpen}
      onPointerDown={(event) => {
        stopCardNav(event)
        onOpen?.()
      }}
      onKeyDown={stopCardNav}
      onClick={(event) => {
        stopCardNav(event)
        onOpen?.()
      }}
      className={`game-card-court-score-button${finished ? ' game-card-court-score-button--finished' : ''}`}
      aria-label={ariaLabel}
    >
      <span className="game-card-court-score-button__value">{value || '0'}</span>
    </button>
  )
}

function CourtScores({
  scoreUnit,
  scoreA,
  scoreB,
  onScoreA,
  onScoreB,
  onGamesCommit,
  disabled,
  finished,
  compact,
  livePointScores,
  onEditingSideChange,
  t,
}: {
  scoreUnit: AmericanoScoringUnit
  scoreA?: string
  scoreB?: string
  onScoreA?: (v: string) => void
  onScoreB?: (v: string) => void
  onGamesCommit?: () => void
  disabled?: boolean
  finished?: boolean
  compact?: boolean
  livePointScores?: { scoreA: string; scoreB: string }
  onEditingSideChange?: (side: 'a' | 'b' | null) => void
  t: TranslateFn
}) {
  const [pickerSide, setPickerSide] = useState<'a' | 'b' | null>(null)
  const scoreControlRef = useRef<HTMLDivElement>(null)
  const fieldLabel = scoreFieldLabel(scoreUnit, t)
  const gamesA = scoreA ?? '0'
  const gamesB = scoreB ?? '0'
  const pointsClass = compact
    ? 'tv-score-readout rounded-xl border-2 border-brand-primary/55 bg-brand-bg-alt px-3 py-1.5 text-4xl leading-none text-brand-primary shadow-md dark:border-brand-accent/60 dark:bg-white/10 dark:text-brand-accent-light md:text-5xl'
    : 'rounded-lg border border-brand-primary/45 bg-brand-bg-alt px-2.5 py-1 text-3xl leading-none text-brand-primary shadow-sm dark:border-brand-accent/50 dark:bg-white/10 dark:text-brand-accent-light md:text-4xl'
  const dividerClass = `game-card-court-score-divider bg-brand-border/50 ${
    compact ? 'w-px self-stretch' : 'h-full min-h-[2.25rem] w-px'
  }`
  const scorePairClass = `game-card-court-score-pair flex items-stretch ${
    compact ? 'gap-3' : 'items-center gap-x-2'
  }`

  const rowDividerClass = `game-card-court-score-row-divider bg-brand-border/50 ${
    compact ? 'w-px self-stretch' : 'h-full min-h-[2rem] w-px'
  }`
  const changePickerSide = (side: 'a' | 'b' | null) => {
    setPickerSide(side)
    onEditingSideChange?.(side)
  }
  const openPicker = (side: 'a' | 'b') => {
    changePickerSide(side)
  }

  useEffect(() => {
    if (!pickerSide) return
    const closeWhenOutside = (event: PointerEvent) => {
      if (!scoreControlRef.current?.contains(event.target as Node)) changePickerSide(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') changePickerSide(null)
    }
    document.addEventListener('pointerdown', closeWhenOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [pickerSide])

  return (
    <div
      ref={scoreControlRef}
      className={`game-card-court-score-stack game-card-court-scores flex flex-col items-center gap-1${pickerSide ? ' game-card-court-score-stack--editing' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) changePickerSide(null)
      }}
    >
      {pickerSide ? (
        <div
          className="game-card-court-score-picker"
          role="listbox"
          aria-label="Select score"
        >
          {Array.from({ length: 7 }, (_, score) => {
            const value = String(score)
            const selected = value === (pickerSide === 'a' ? gamesA : gamesB)
            return (
              <button
                key={score}
                type="button"
                role="option"
                tabIndex={0}
                aria-selected={selected}
                className={`game-card-court-score-picker__option${selected ? ' game-card-court-score-picker__option--selected' : ''}`}
                onClick={(event) => {
                  stopCardNav(event)
                  if (pickerSide === 'a') onScoreA?.(value)
                  else onScoreB?.(value)
                  changePickerSide(null)
                  onGamesCommit?.()
                }}
              >
                {score}
              </button>
            )
          })}
        </div>
      ) : null}
      {!pickerSide ? (
      <div className="game-card-court-score-row flex items-stretch justify-center gap-2">
        {livePointScores ? (
          <section
            className="game-card-court-score-section game-card-court-score-section--points"
            aria-label="Points"
          >
            <div className={scorePairClass}>
              <div className="flex items-center justify-center tabular-nums">
                <span className={`font-display font-extrabold tabular-nums ${pointsClass}`}>
                  {livePointScores.scoreA}
                </span>
              </div>
              <span className={dividerClass} aria-hidden="true" />
              <div className="flex items-center justify-center tabular-nums">
                <span className={`font-display font-extrabold tabular-nums ${pointsClass}`}>
                  {livePointScores.scoreB}
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {livePointScores ? <span className={rowDividerClass} aria-hidden="true" /> : null}

        <section className="game-card-court-score-section game-card-court-score-section--games" aria-label="Games">
          <div className={scorePairClass}>
            <div className="flex items-center justify-center tabular-nums">
              <CourtScoreButton
                value={gamesA}
                onOpen={onScoreA ? () => openPicker('a') : undefined}
                disabled={disabled}
                finished={finished}
                ariaLabel={t('aria.teamAScore', { unit: fieldLabel })}
              />
            </div>
            <span className={dividerClass} aria-hidden="true" />
            <div className="flex items-center justify-center tabular-nums">
              <CourtScoreButton
                value={gamesB}
                onOpen={onScoreB ? () => openPicker('b') : undefined}
                disabled={disabled}
                finished={finished}
                ariaLabel={t('aria.teamBScore', { unit: fieldLabel })}
              />
            </div>
          </div>
        </section>
      </div>
      ) : null}
    </div>
  )
}

export function CourtMatchCell({
  teamA,
  teamB,
  scoreUnit,
  scoreA,
  scoreB,
  onScoreA,
  onScoreB,
  onGamesCommit,
  disabled = false,
  finished = false,
  scoreMax: _scoreMax,
  teamAPlayers,
  teamBPlayers,
  teamALabel,
  teamBLabel,
  currentUserId: _currentUserId,
  currentUserDisplayName: _currentUserDisplayName,
  currentUserAvatarUrl: _currentUserAvatarUrl,
  embedded = false,
  compact = false,
  scoreFirst = false,
  showScores = true,
  livePointScores,
  backupPointA: _backupPointA,
  backupPointB: _backupPointB,
  onBackupPointA: _onBackupPointA,
  onBackupPointB: _onBackupPointB,
  colorNamesByGender = false,
  t,
}: {
  teamA: string[]
  teamB: string[]
  scoreUnit: AmericanoScoringUnit
  scoreA?: string
  scoreB?: string
  onScoreA?: (v: string) => void
  onScoreB?: (v: string) => void
  onGamesCommit?: () => void
  disabled?: boolean
  finished?: boolean
  scoreMax?: number
  teamAPlayers?: CourtPlayer[]
  teamBPlayers?: CourtPlayer[]
  teamALabel?: string
  teamBLabel?: string
  currentUserId?: string | null
  currentUserDisplayName?: string | null
  currentUserAvatarUrl?: string | null
  embedded?: boolean
  compact?: boolean
  scoreFirst?: boolean
  showScores?: boolean
  /** Live gesture points in the centre; games stay in scoreA/scoreB for the subline. */
  livePointScores?: { scoreA: string; scoreB: string }
  /** Editable backup tennis points (0 / 15 / 30 / 40) under the live readout. */
  backupPointA?: string
  backupPointB?: string
  onBackupPointA?: (v: string) => void
  onBackupPointB?: (v: string) => void
  colorNamesByGender?: boolean
  t: TranslateFn
}) {
  const [editingScoreSide, setEditingScoreSide] = useState<'a' | 'b' | null>(null)
  const fallbackNames = compactDisplayNames([
    teamA[0] ?? '',
    teamA[1] ?? '',
    teamB[0] ?? '',
    teamB[1] ?? '',
  ])
  const courtPlayerSlot = (
    player: CourtPlayer | undefined,
    teamName: string,
    compactName: string,
  ): CourtPlayer => {
    const playerName = player?.name?.trim()
    const generic = !playerName || playerName === 'Player'
    const name =
      (generic ? '' : playerName) ||
      teamName.trim() ||
      (compactName !== 'Player' ? compactName : '') ||
      'Player'
    if (!player) return { id: null, name, avatarUrl: null }
    return generic ? { ...player, name } : player
  }
  const teamAPlayerList: CourtPlayer[] = [
    courtPlayerSlot(teamAPlayers?.[0], teamA[0] ?? '', fallbackNames[0] ?? ''),
    courtPlayerSlot(teamAPlayers?.[1], teamA[1] ?? '', fallbackNames[1] ?? ''),
  ]
  const teamBPlayerList: CourtPlayer[] = [
    courtPlayerSlot(teamBPlayers?.[0], teamB[0] ?? '', fallbackNames[2] ?? ''),
    courtPlayerSlot(teamBPlayers?.[1], teamB[1] ?? '', fallbackNames[3] ?? ''),
  ]
  // #region agent log
  useEffect(() => {
    if (!import.meta.env.DEV || !compact) return
    const resolved = [...teamAPlayerList, ...teamBPlayerList].map((player) => player.name)
    const displayed = resolved.map((name) => compactDisplayNames([name])[0])
    if (resolved.some((name) => name === 'Player' || displayed.some((n) => n === 'Player'))) {
      debugSessionLog(
        'CourtCard.tsx:CourtMatchCell',
        'resolved court player names',
        {
          teamAIn: teamA,
          teamBIn: teamB,
          fallbackNames,
          rawPlayerNames: [
            teamAPlayers?.[0]?.name ?? null,
            teamAPlayers?.[1]?.name ?? null,
            teamBPlayers?.[0]?.name ?? null,
            teamBPlayers?.[1]?.name ?? null,
          ],
          resolved,
          displayed,
        },
        'H-E',
        '5d6061',
      )
    }
  }, [compact, teamA, teamB, teamAPlayers, teamBPlayers, teamAPlayerList, teamBPlayerList, fallbackNames])
  // #endregion
  const playerClass = () =>
    `flex min-w-0 items-center rounded ${
      compact ? 'min-h-16 gap-3 py-1.5' : 'min-h-11 gap-1.5 py-0.5'
    } ${finished ? 'px-0 text-brand-muted' : 'px-0 text-brand-text'}`

  const nameClass = (player: CourtPlayer, align: 'left' | 'right') => {
    const genderColor =
      colorNamesByGender && player.gender ? GENDER_CHIP_COLORS[player.gender] : 'text-brand-text'
    const editingClass =
      (editingScoreSide === 'a' && align === 'left') ||
      (editingScoreSide === 'b' && align === 'right')
        ? ' game-card-court-player__name--score-editing'
        : ''
    return compact
      ? `game-card-court-player__name truncate font-extrabold leading-tight ${genderColor}${editingClass}`
      : `truncate text-lg font-semibold leading-tight ${genderColor} md:text-xl${editingClass}`
  }
  const avatarClass = compact
    ? 'game-card-court-player__avatar shrink-0 rounded-full object-cover ring-2 ring-brand-border/60'
    : 'h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-brand-border/60 md:h-9 md:w-9'

  const playerEl = (player: CourtPlayer, align: 'left' | 'right') => {
    const isRegistered = Boolean(player.id)
    const displayAvatarUrl = isRegistered ? player.avatarUrl ?? null : null
    const [displayName] = compactDisplayNames([player.name])
    const nameEl = (
      <PlayerNameLink
        displayName={displayName}
        profileId={player.id}
        padelPlayerId={player.padelPlayerId}
        className={nameClass(player, align)}
      />
    )
    const avatarEl = (
      <PlayerAvatarLink
        displayName={player.name}
        avatarUrl={displayAvatarUrl}
        profileId={player.id}
        padelPlayerId={player.padelPlayerId}
        imgClassName={avatarClass}
        disabled={!isRegistered}
      />
    )

    return (
      <p
        className={`${playerClass()} ${
          align === 'right' ? 'justify-end text-right' : ''
        }`}
      >
        {align === 'right' ? (
          <>
            {nameEl}
            {avatarEl}
          </>
        ) : (
          <>
            {avatarEl}
            {nameEl}
          </>
        )}
      </p>
    )
  }

  const teamTitle = (label: string | undefined, align: 'left' | 'right') =>
    label ? (
      <p
        className={`font-display font-bold leading-tight text-brand-primary ${
          compact ? 'game-card-court-team-label tv-team-label whitespace-normal break-words' : 'truncate text-sm md:text-base'
        } ${align === 'right' ? 'text-right' : ''}`}
      >
        {label}
      </p>
    ) : null

  const showTeamLabels = Boolean(teamALabel || teamBLabel)
  const sideCellClass = (side: 'left' | 'right') =>
    `game-card-court-match__side game-card-court-match__side--${side} min-w-0 w-full ${
      side === 'right' ? 'justify-self-end' : 'justify-self-start'
    }`
  const labelSlotClass = 'game-card-court-team-label-slot min-h-12'
  const duoAlignedSides = (
    <>
      {showTeamLabels ? (
        <>
          <div className={`${sideCellClass('left')} col-start-1 row-start-1 self-start`}>
            <div className={labelSlotClass}>{teamTitle(teamALabel, 'left')}</div>
          </div>
          <div className={`${sideCellClass('right')} col-start-2 row-start-1 self-start`}>
            <div className={labelSlotClass}>{teamTitle(teamBLabel, 'right')}</div>
          </div>
        </>
      ) : null}
      <div className={`${sideCellClass('left')} ${showTeamLabels ? 'row-start-2' : 'row-start-1'} self-center`}>
        {playerEl(teamAPlayerList[0]!, 'left')}
      </div>
      <div className={`${sideCellClass('right')} ${showTeamLabels ? 'row-start-2' : 'row-start-1'} self-center`}>
        {playerEl(teamBPlayerList[0]!, 'right')}
      </div>
      <div className={`${sideCellClass('left')} ${showTeamLabels ? 'row-start-3' : 'row-start-2'} self-center`}>
        {playerEl(teamAPlayerList[1]!, 'left')}
      </div>
      <div className={`${sideCellClass('right')} ${showTeamLabels ? 'row-start-3' : 'row-start-2'} self-center`}>
        {playerEl(teamBPlayerList[1]!, 'right')}
      </div>
      {teamAPlayerList[0]?.teamEmblemUrl ? (
        <img
          className="game-card-court-team-emblem game-card-court-team-emblem--left"
          src={teamAPlayerList[0].teamEmblemUrl}
          alt={`${teamAPlayerList[0].name} and ${teamAPlayerList[1]?.name ?? ''} team animal`}
          draggable={false}
        />
      ) : null}
      {teamBPlayerList[0]?.teamEmblemUrl ? (
        <img
          className="game-card-court-team-emblem game-card-court-team-emblem--right"
          src={teamBPlayerList[0].teamEmblemUrl}
          alt={`${teamBPlayerList[0].name} and ${teamBPlayerList[1]?.name ?? ''} team animal`}
          draggable={false}
        />
      ) : null}
    </>
  )
  const sidesGridClass = `game-card-court-match tv-court-match-grid grid min-h-0 w-full flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-y-2.5 game-card-court-match--sides${
    showTeamLabels ? ' grid-rows-[auto_auto_auto]' : ' grid-rows-[auto_auto]'
  }`

  const scoreCenter = showScores ? (
    <CourtScores
      scoreUnit={scoreUnit}
      scoreA={scoreA}
      scoreB={scoreB}
      onScoreA={onScoreA}
      onScoreB={onScoreB}
      onGamesCommit={onGamesCommit}
      disabled={disabled}
      finished={finished}
      compact={compact}
      livePointScores={livePointScores}
      onEditingSideChange={setEditingScoreSide}
      t={t}
    />
  ) : null

  const compactTeamSides = duoAlignedSides

  const usesScoreFirstLayout = compact || scoreFirst

  const grid = usesScoreFirstLayout ? (
    showScores ? (
      <>
        <div className="tv-court-match-scores game-card-court-match-scores flex shrink-0 justify-center">{scoreCenter}</div>
        <div className={`${sidesGridClass}${scoreFirst ? ' game-card-court-match--score-first' : ''}`}>
          {compactTeamSides}
        </div>
      </>
    ) : (
      <div className={`${sidesGridClass}${scoreFirst ? ' game-card-court-match--score-first' : ''}`}>
        {compactTeamSides}
      </div>
    )
  ) : showScores ? (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_1px_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 px-0.5 py-1 md:gap-x-3 md:px-1 md:py-1.5">
      <div className="min-w-0 justify-self-start space-y-1">
        {showTeamLabels ? <div className={labelSlotClass}>{teamTitle(teamALabel, 'left')}</div> : null}
        {playerEl(teamAPlayerList[0]!, 'left')}
        {playerEl(teamAPlayerList[1]!, 'left')}
      </div>
      <div className="col-start-2 col-span-3 flex justify-center">{scoreCenter}</div>
      <div className="min-w-0 justify-self-end space-y-1">
        {showTeamLabels ? <div className={labelSlotClass}>{teamTitle(teamBLabel, 'right')}</div> : null}
        {playerEl(teamBPlayerList[0]!, 'right')}
        {playerEl(teamBPlayerList[1]!, 'right')}
      </div>
    </div>
  ) : (
    <div className={`${sidesGridClass} px-0.5 py-1 md:px-1 md:py-1.5`}>{duoAlignedSides}</div>
  )

  if (embedded) {
    return (
      <div
        aria-label={`${teamA[0]} and ${teamA[1]} against ${teamB[0]} and ${teamB[1]}`}
        className={usesScoreFirstLayout ? 'tv-court-match game-card-court-match-wrap flex min-h-0 w-full flex-1 flex-col' : undefined}
      >
        {grid}
      </div>
    )
  }

  return (
    <div
      className={
        finished
          ? 'overflow-hidden rounded-lg border border-brand-border/40 bg-[#f3f2f0] dark:border-white/12 dark:bg-white/[0.04]'
          : 'overflow-hidden rounded-lg border border-brand-border/60 bg-brand-surface dark:border-white/15 dark:bg-white/[0.05]'
      }
      aria-label={`${teamA[0]} and ${teamA[1]} against ${teamB[0]} and ${teamB[1]}`}
    >
      {grid}
    </div>
  )
}
function CourtLabelRow({
  courtLabel,
  court: _court,
  finished,
  gestureScoreHref,
  gestureScoreLive = false,
  manualScoreHref,
  size = 'mobile',
  fillCell = false,
  t,
}: {
  courtLabel: string
  court: LiveCourt | ScoringGameCourt
  finished: boolean
  gestureScoreHref?: string
  gestureScoreLive?: boolean
  manualScoreHref?: string
  size?: GameCardSize
  fillCell?: boolean
  t: TranslateFn
}) {
  const label = displayCourtLabel(courtLabel, t)
  const titleClass = courtLabelClass(finished)
  const gridCell = fillCell || isTvSize(size)
  return (
    <div
      className={`game-card-court-label-row flex items-center gap-2 px-2 ${
        gridCell ? 'game-card-court-label-row tv-court-label-row min-h-0 shrink-0 py-1' : 'min-h-9 px-3 py-1.5'
      }`}
    >
      <p className={`game-card-court-label min-w-0 flex-1 truncate text-center ${titleClass}${gridCell ? ' tv-court-label' : ''}`}>
        {label}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        {gestureScoreHref ? (
          <CourtGestureScoreButton
            href={gestureScoreHref}
            live={gestureScoreLive}
            ariaLabel={t('court.scoreTrackerAria')}
            label={t('court.startScoring')}
            showLabel={!gridCell && size !== 'mobile'}
          />
        ) : null}
        {manualScoreHref ? <CourtManualScoreButton href={manualScoreHref} /> : null}
      </div>
    </div>
  )
}
