import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { displayCourtLabel } from '../../lib/courtDisplay'
import type { TranslateFn } from '../../i18n'
import type { AmericanoScoringUnit } from '../../lib/competitionPresets'
import { bumpScoreField, scoreDigitsOnly } from '../../lib/competitionScoreInput'
import { compactDisplayNames } from '../../lib/leaderboardEntries'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import { CourtGestureScoreButton } from '../CourtGestureScoreButton'
import { PlayerAvatarLink } from '../PlayerAvatarLink'
import { PlayerNameLink } from '../PlayerNameLink'
import type { LiveCourt, ScoringGameCourt } from './gameBoardTypes'

export function stopCardNav(e: { stopPropagation: () => void }) {
  e.stopPropagation()
}

export function courtLiveHref({
  liveCourtEnabled,
  friendly,
  sessionId,
  competitionId,
  gameNumber,
  courtLabel: _courtLabel,
  courtId,
  canEditScores,
}: {
  liveCourtEnabled: boolean
  friendly: boolean
  sessionId?: string
  competitionId?: string
  gameNumber: number
  courtLabel: string
  courtId?: string
  canEditScores: boolean
}): string | undefined {
  if (!liveCourtEnabled || !sessionId || friendly) return undefined
  if (competitionId && courtId && !canEditScores) {
    return `/competitions/${competitionId}/games/${gameNumber}/courts/${courtId}/live-court`
  }
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
  currentUserId,
  court,
  finished,
}: {
  gestureScoreEnabled: boolean
  friendly: boolean
  sessionId?: string
  competitionId?: string
  gameNumber: number
  courtLabel: string
  courtId?: string
  currentUserId?: string | null
  court: {
    playerIds?: string[]
    teamAPlayers?: CourtPlayer[]
    teamBPlayers?: CourtPlayer[]
  }
  finished: boolean
}): string | undefined {
  if (!gestureScoreEnabled || finished || !sessionId || !currentUserId) return undefined
  if (!courtHasCurrentUser(currentUserId, court)) return undefined
  if (friendly) {
    return `/friendly/${sessionId}/games/${gameNumber}/courts/${encodeURIComponent(courtLabel)}/gesture-score`
  }
  if (competitionId && courtId) {
    return `/competitions/${competitionId}/games/${gameNumber}/courts/${courtId}/gesture-score`
  }
  return undefined
}

export function courtHasCurrentUser(
  currentUserId: string | null | undefined,
  court: {
    playerIds?: string[]
    teamAPlayers?: CourtPlayer[]
    teamBPlayers?: CourtPlayer[]
  },
): boolean {
  if (!currentUserId) return false
  return Boolean(
    court.teamAPlayers?.some((player) => player.id === currentUserId) ||
      court.teamBPlayers?.some((player) => player.id === currentUserId) ||
      court.playerIds?.includes(currentUserId),
  )
}

const COURT_LABEL_CLASS =
  'text-center font-display text-2xl font-bold text-brand-accent dark:text-brand-tan md:text-3xl'
const CURRENT_PLAYER_HIGHLIGHT_CLASS =
  'animate-pulse rounded bg-brand-bg-alt px-1 text-brand-accent dark:bg-white/10 dark:text-brand-accent-light'

function courtLabelClass(
  currentUserId: string | null | undefined,
  court: Parameters<typeof courtHasCurrentUser>[1],
  finished = false,
) {
  const base = finished
    ? 'text-center font-display text-2xl font-bold text-brand-sage dark:text-brand-muted md:text-3xl'
    : 'text-center font-display text-2xl font-bold md:text-3xl'
  return courtHasCurrentUser(currentUserId, court)
    ? `${base} ${CURRENT_PLAYER_HIGHLIGHT_CLASS}`
    : finished
      ? base
      : COURT_LABEL_CLASS
}

function courtCardShellClass({
  finished,
  isMyCourt = false,
}: {
  finished: boolean
  isMyCourt?: boolean
}) {
  const parts = [
    'w-full min-w-0 overflow-hidden rounded-xl border-2 bg-brand-surface shadow-[0_6px_18px_-8px_rgba(96,45,36,0.28)] transition dark:border-white/15 dark:bg-white/[0.06] dark:shadow-none',
  ]
  if (finished) {
    parts.push(
      'border-brand-border/50 bg-[#faf9f8] shadow-[0_2px_8px_-6px_rgba(96,45,36,0.15)] dark:border-white/12 dark:bg-white/[0.04] dark:shadow-none',
    )
  } else {
    parts.push('border-brand-primary/35 dark:border-brand-accent/30')
  }
  if (isMyCourt && !finished) {
    parts.push('ring-2 ring-brand-accent/35')
  }
  return parts.join(' ')
}

export function CourtCard({
  courtLabel,
  currentUserId,
  court,
  finished,
  href,
  gestureScoreHref,
  gestureScoreLive = false,
  tvCompact = false,
  children,
  t,
}: {
  courtLabel: string
  currentUserId?: string | null
  court: LiveCourt | ScoringGameCourt
  finished: boolean
  href?: string
  gestureScoreHref?: string
  gestureScoreLive?: boolean
  tvCompact?: boolean
  children: ReactNode
  t: TranslateFn
}) {
  const navigate = useNavigate()
  const isMyCourt = courtHasCurrentUser(currentUserId, court)
  const shellClass = `${courtCardShellClass({ finished, isMyCourt })}${
    tvCompact ? ' tv-court-card' : ''
  }${
    href
      ? ' cursor-pointer transition hover:border-brand-accent/45 active:scale-[0.99] active:opacity-95'
      : ''
  }`
  const body = (
    <>
      <div
        className={`border-b ${
          finished
            ? 'border-brand-border/40 bg-brand-surface dark:bg-white/[0.03]'
            : 'border-brand-border/50 bg-brand-surface dark:bg-white/[0.04]'
        }`}
      >
        <CourtLabelRow
          courtLabel={courtLabel}
          currentUserId={currentUserId}
          court={court}
          finished={finished}
          gestureScoreHref={gestureScoreHref}
          gestureScoreLive={gestureScoreLive}
          tvCompact={tvCompact}
          t={t}
        />
      </div>
      <div
        className={
          tvCompact
            ? 'tv-court-card-body flex min-h-0 flex-1 flex-col p-1.5'
            : 'p-2 md:p-2.5'
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
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  finished?: boolean
  ariaLabel: string
  scoreMax?: number
  tv?: boolean
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
      <button
        type="button"
        disabled={disabled}
        aria-label={`Increase ${ariaLabel}`}
        className={stepClass}
        onClick={() => onChange(bumpScoreField(value, 1, scoreMax))}
      >
        ▲
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
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
      <button
        type="button"
        disabled={disabled}
        aria-label={`Decrease ${ariaLabel}`}
        className={stepClass}
        onClick={() => onChange(bumpScoreField(value, -1, scoreMax))}
      >
        ▼
      </button>
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
  disabled = false,
  finished = false,
  scoreMax,
  teamAPlayers,
  teamBPlayers,
  teamALabel,
  teamBLabel,
  currentUserId,
  currentUserAvatarUrl,
  embedded = false,
  compact = false,
  t,
}: {
  teamA: string[]
  teamB: string[]
  scoreUnit: AmericanoScoringUnit
  scoreA?: string
  scoreB?: string
  onScoreA?: (v: string) => void
  onScoreB?: (v: string) => void
  disabled?: boolean
  finished?: boolean
  scoreMax?: number
  teamAPlayers?: CourtPlayer[]
  teamBPlayers?: CourtPlayer[]
  teamALabel?: string
  teamBLabel?: string
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  embedded?: boolean
  compact?: boolean
  t: TranslateFn
}) {
  const fieldLabel = scoreFieldLabel(scoreUnit, t)
  const editable = Boolean(onScoreA && onScoreB && !disabled)
  const fallbackNames = compactDisplayNames([
    teamA[0] ?? '',
    teamA[1] ?? '',
    teamB[0] ?? '',
    teamB[1] ?? '',
  ])
  const teamAPlayerList: CourtPlayer[] = [
    teamAPlayers?.[0] ?? { id: null, name: fallbackNames[0] ?? '', avatarUrl: null },
    teamAPlayers?.[1] ?? { id: null, name: fallbackNames[1] ?? '', avatarUrl: null },
  ]
  const teamBPlayerList: CourtPlayer[] = [
    teamBPlayers?.[0] ?? { id: null, name: fallbackNames[2] ?? '', avatarUrl: null },
    teamBPlayers?.[1] ?? { id: null, name: fallbackNames[3] ?? '', avatarUrl: null },
  ]
  const playerClass = (isCurrent: boolean) =>
    `flex min-w-0 items-center rounded ${
      compact ? 'min-h-16 gap-3 py-1.5' : 'min-h-11 gap-1.5 py-0.5'
    } ${
      isCurrent
        ? CURRENT_PLAYER_HIGHLIGHT_CLASS
        : finished
          ? 'px-0 text-brand-muted'
          : 'px-0 text-brand-text'
    }`

  const scoreAEl = editable ? (
    <ScoreStepper
      value={scoreA ?? ''}
      onChange={(v) => onScoreA?.(v)}
      disabled={disabled}
      finished={finished}
      ariaLabel={t('aria.teamAScore', { unit: fieldLabel })}
      scoreMax={scoreMax}
      tv={compact}
    />
  ) : scoreA ? (
    <span
      className={`font-display font-extrabold tabular-nums ${
        compact
          ? 'tv-score-readout rounded-xl border-2 border-brand-primary/55 bg-brand-bg-alt px-3 py-1.5 text-2xl leading-none text-brand-primary shadow-md dark:border-brand-accent/60 dark:bg-white/10 dark:text-brand-accent-light'
          : 'text-base text-brand-accent md:text-lg'
      }`}
    >
      {scoreA}
    </span>
  ) : (
    <span className="inline-block min-w-[1.25rem]" aria-hidden />
  )

  const scoreBEl = editable ? (
    <ScoreStepper
      value={scoreB ?? ''}
      onChange={(v) => onScoreB?.(v)}
      disabled={disabled}
      finished={finished}
      ariaLabel={t('aria.teamBScore', { unit: fieldLabel })}
      scoreMax={scoreMax}
      tv={compact}
    />
  ) : scoreB ? (
    <span
      className={`font-display font-extrabold tabular-nums ${
        compact
          ? 'tv-score-readout rounded-xl border-2 border-brand-primary/55 bg-brand-bg-alt px-3 py-1.5 text-2xl leading-none text-brand-primary shadow-md dark:border-brand-accent/60 dark:bg-white/10 dark:text-brand-accent-light'
          : 'text-base text-brand-accent md:text-lg'
      }`}
    >
      {scoreB}
    </span>
  ) : (
    <span className="inline-block min-w-[1.25rem]" aria-hidden />
  )

  const nameClass = compact
    ? 'truncate text-4xl font-extrabold leading-tight text-brand-text'
    : 'truncate text-lg font-semibold leading-tight text-brand-text md:text-xl'
  const avatarClass = compact
    ? 'h-14 w-14 shrink-0 rounded-full object-cover text-2xl ring-2 ring-brand-border/60'
    : 'h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-brand-border/60 md:h-9 md:w-9'

  const playerEl = (player: CourtPlayer, align: 'left' | 'right') => {
    const isCurrent = Boolean(currentUserId && player.id === currentUserId)
    const isRegistered = Boolean(player.id)
    const displayAvatarUrl = isRegistered
      ? player.avatarUrl ?? (isCurrent ? currentUserAvatarUrl ?? null : null)
      : null
    const [displayName] = compactDisplayNames([player.name])
    const nameEl = (
      <PlayerNameLink
        displayName={displayName}
        profileId={player.id}
        padelPlayerId={player.padelPlayerId}
        className={nameClass}
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
        className={`${playerClass(isCurrent)} ${
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
          compact ? 'tv-team-label whitespace-normal break-words text-4xl' : 'truncate text-sm md:text-base'
        } ${align === 'right' ? 'text-right' : ''}`}
      >
        {label}
      </p>
    ) : null

  const grid = compact ? (
    <div className="tv-court-match-grid grid min-h-0 w-full flex-1 grid-cols-[1fr_auto_1fr] items-center gap-x-6 px-6">
      <div className="flex min-w-0 flex-col justify-center gap-2.5 justify-self-start">
        {teamTitle(teamALabel, 'left')}
        {playerEl(teamAPlayerList[0]!, 'left')}
        {playerEl(teamAPlayerList[1]!, 'left')}
      </div>
      <div className="tv-court-match-scores flex shrink-0 items-stretch gap-3 justify-self-center">
        <div className="flex items-center justify-center tabular-nums">{scoreAEl}</div>
        <span className="w-px self-stretch bg-brand-border/60" aria-hidden="true" />
        <div className="flex items-center justify-center tabular-nums">{scoreBEl}</div>
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-2.5 justify-self-end">
        {teamTitle(teamBLabel, 'right')}
        {playerEl(teamBPlayerList[0]!, 'right')}
        {playerEl(teamBPlayerList[1]!, 'right')}
      </div>
    </div>
  ) : (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_1px_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 px-0.5 py-1 md:gap-x-3 md:px-1 md:py-1.5">
      <div className="min-w-0 justify-self-start space-y-1">
        {teamTitle(teamALabel, 'left')}
        {playerEl(teamAPlayerList[0]!, 'left')}
        {playerEl(teamAPlayerList[1]!, 'left')}
      </div>
      <div className="flex min-w-[1.25rem] items-center justify-center tabular-nums">{scoreAEl}</div>
      <span className="h-full min-h-[2.5rem] w-px bg-brand-border/60" aria-hidden="true" />
      <div className="flex min-w-[1.25rem] items-center justify-center tabular-nums">{scoreBEl}</div>
      <div className="min-w-0 justify-self-end space-y-1">
        {teamTitle(teamBLabel, 'right')}
        {playerEl(teamBPlayerList[0]!, 'right')}
        {playerEl(teamBPlayerList[1]!, 'right')}
      </div>
    </div>
  )

  if (embedded) {
    return (
      <div
        aria-label={`${teamA[0]} and ${teamA[1]} against ${teamB[0]} and ${teamB[1]}`}
        className={compact ? 'tv-court-match flex min-h-0 w-full flex-1 flex-col' : undefined}
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
  currentUserId,
  court,
  finished,
  gestureScoreHref,
  gestureScoreLive = false,
  tvCompact = false,
  t,
}: {
  courtLabel: string
  currentUserId?: string | null
  court: LiveCourt | ScoringGameCourt
  finished: boolean
  gestureScoreHref?: string
  gestureScoreLive?: boolean
  tvCompact?: boolean
  t: TranslateFn
}) {
  const label = displayCourtLabel(courtLabel, t)
  const titleClass = courtLabelClass(currentUserId, court, finished)
  return (
    <div
      className={`flex items-center justify-center gap-2 px-2 ${
        tvCompact ? 'tv-court-label-row min-h-20 py-3' : 'min-h-12 px-3 py-2'
      }`}
    >
      {gestureScoreHref ? (
        <CourtGestureScoreButton href={gestureScoreHref} live={gestureScoreLive} />
      ) : (
        <span className="w-8 shrink-0" aria-hidden />
      )}
      <p className={`min-w-0 flex-1 truncate text-center ${titleClass}${tvCompact ? ' tv-court-label !text-6xl' : ''}`}>
        {label}
      </p>
      <span className="w-8 shrink-0" aria-hidden />
    </div>
  )
}
