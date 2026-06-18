import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { displayCourtLabel } from '../../lib/courtDisplay'
import type { TranslateFn } from '../../i18n'
import type { AmericanoScoringUnit } from '../../lib/competitionPresets'
import { bumpScoreField, scoreDigitsOnly } from '../../lib/competitionScoreInput'
import { compactDisplayNames } from '../../lib/leaderboardEntries'
import type { CourtPlayer } from '../../lib/americanoSchedule'
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

function courtHasCurrentUser(
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
  tvCompact = false,
  children,
  t,
}: {
  courtLabel: string
  currentUserId?: string | null
  court: LiveCourt | ScoringGameCourt
  finished: boolean
  href?: string
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
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  finished?: boolean
  ariaLabel: string
  scoreMax?: number
}) {
  const inputClass = finished
    ? 'h-8 w-8 rounded-lg border border-brand-border/50 bg-[#faf9f7] px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-brand-sage disabled:text-brand-muted/60 dark:border-white/15 dark:bg-white/[0.08] dark:text-brand-text md:h-10 md:w-10 md:text-base'
    : 'h-8 w-8 rounded-lg border border-brand-border/80 bg-brand-surface px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-brand-primary disabled:text-brand-muted/60 dark:border-white/20 dark:bg-white/[0.08] dark:text-brand-text md:h-10 md:w-10 md:text-base'
  const stepClass =
    'flex h-5 w-8 items-center justify-center rounded text-[10px] font-bold leading-none text-brand-muted active:bg-brand-bg-alt disabled:opacity-30 dark:active:bg-white/10 md:h-6 md:w-10 md:text-xs'

  return (
    <div className="flex flex-col items-center gap-0.5" onClick={stopCardNav} onKeyDown={stopCardNav}>
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
        className={inputClass}
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
    `flex min-w-0 items-center gap-1.5 rounded py-0.5 ${
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
    />
  ) : scoreA ? (
    <span className="text-base font-bold tabular-nums text-brand-accent md:text-lg">{scoreA}</span>
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
    />
  ) : scoreB ? (
    <span className="text-base font-bold tabular-nums text-brand-accent md:text-lg">{scoreB}</span>
  ) : (
    <span className="inline-block min-w-[1.25rem]" aria-hidden />
  )

  const nameClass = compact
    ? 'truncate text-sm font-semibold leading-tight text-brand-text'
    : 'truncate text-lg font-semibold leading-tight text-brand-text md:text-xl'
  const avatarClass = compact
    ? 'h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-brand-border/60'
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
    const avatarEl = displayAvatarUrl ? (
      <img src={displayAvatarUrl} alt="" className={avatarClass} />
    ) : null
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
        className={`truncate text-xs font-bold uppercase tracking-wide text-brand-primary md:text-sm ${
          align === 'right' ? 'text-right' : ''
        }`}
      >
        {label}
      </p>
    ) : null

  const grid = (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto_1px_auto_minmax(0,1fr)] items-center ${
        compact
          ? 'tv-court-match-grid min-h-0 flex-1 items-stretch gap-x-1 gap-y-0.5 px-0 py-0'
          : 'gap-x-2 gap-y-1 px-0.5 py-1 md:gap-x-3 md:px-1 md:py-1.5'
      }`}
    >
        <div className="min-w-0 justify-self-start space-y-1">
          {teamTitle(teamALabel, 'left')}
          {playerEl(teamAPlayerList[0]!, 'left')}
          {playerEl(teamAPlayerList[1]!, 'left')}
        </div>
        <div className="flex min-w-[1.25rem] items-center justify-center tabular-nums">
          {scoreAEl}
        </div>
        <span className={`w-px bg-brand-border/60 ${compact ? 'self-stretch' : 'h-full min-h-[2.5rem]'}`} aria-hidden="true" />
        <div className="flex min-w-[1.25rem] items-center justify-center tabular-nums">
          {scoreBEl}
        </div>
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
        className={compact ? 'tv-court-match flex min-h-0 flex-1 flex-col' : undefined}
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
  tvCompact = false,
  t,
}: {
  courtLabel: string
  currentUserId?: string | null
  court: LiveCourt | ScoringGameCourt
  finished: boolean
  tvCompact?: boolean
  t: TranslateFn
}) {
  const label = displayCourtLabel(courtLabel, t)
  const titleClass = courtLabelClass(currentUserId, court, finished)
  return (
    <div
      className={`flex items-center justify-center px-2 ${
        tvCompact ? 'min-h-9 py-1' : 'min-h-12 px-3 py-2'
      }`}
    >
      <p className={`truncate text-center ${titleClass}`}>{label}</p>
    </div>
  )
}
