import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ScoreTrackerIcon } from './ScoreTrackerIcon'
import { Link, useNavigate } from 'react-router-dom'
import { displayCourtLabel } from '../lib/courtDisplay'
import { resolveCourtRef, type CourtRef, type CourtRefsLookup } from '../lib/courtRefs'
import { liveCourtScoreKey, type LiveCourtGamesScore } from '../lib/liveCourtScore'
import { friendlyCourtLivePath } from '../lib/friendlyCourtLive'
import { useTranslation } from '../hooks/useTranslation'
import type { TranslateFn } from '../i18n'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { pivotScheduleByGame, type CourtColumn } from '../lib/competitionCourtBoard'
import { isScoringTimeUnlocked } from '../lib/competitionScoringUnlock'
import { playTwoMinuteAlarm, TWO_MINUTES_MS } from '../lib/gameCountdownAlarm'
import { RANKED_GAME_MINUTES } from '../lib/competitionLayout'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import {
  bumpScoreField,
  effectiveScoreField,
  parseScoreField,
  scoreDigitsOnly,
} from '../lib/competitionScoreInput'
import { compactDisplayNames, firstDisplayName } from '../lib/leaderboardEntries'
import type { CourtPlayer } from '../lib/americanoSchedule'
import type { FriendlyCourtScoreSubmit } from '../lib/friendlyManualScore'
import type { MatchTeam } from '../lib/types'

export type { FriendlyCourtScoreSubmit }

type LiveCourt = {
  courtId: string
  courtName: string
  teamA: string[]
  teamB: string[]
  playerIds: string[]
  teamAPlayers?: CourtPlayer[]
  teamBPlayers?: CourtPlayer[]
}

type Props = {
  competitionId?: string
  friendlySessionId?: string
  friendly?: boolean
  columns: CourtColumn[]
  mode: 'preview' | 'scoring'
  activeGameNumber?: number
  scoreUnit?: AmericanoScoringUnit
  playTo?: number
  roundId?: string
  liveCourtsByGame?: Map<number, LiveCourt[]>
  canLog?: boolean
  roundIdForGame?: (gameNumber: number) => string | undefined
  courtIdByLabel?: Map<string, string>
  matchForCourt?: (
    roundId: string,
    courtId: string,
  ) => {
    score_summary?: string
    teamAPoints?: number
    teamBPoints?: number
    winner?: MatchTeam
    playedAt?: string
  } | undefined
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  onSubmitFriendlyScores?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void
  now?: number
  gameMinutes?: number
  roundTimesByGame?: Map<number, { startsAt: number; endsAt: number }>
  roundStatusByGame?: Map<number, 'pending' | 'active' | 'complete'>
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  isAdmin?: boolean
  courtRefs?: CourtRefsLookup
  liveCourtScores?: Map<string, LiveCourtGamesScore>
}

type RoundStatus = 'pending' | 'active' | 'complete'
type CountdownState = 'starts' | 'playing' | 'finished' | 'scheduled'

function gameCardShellClass({
  finished,
  isCurrentGame,
  isMyGame = false,
}: {
  finished: boolean
  isCurrentGame: boolean
  isMyGame?: boolean
}) {
  const parts = [
    'w-full min-w-0 overflow-hidden rounded-2xl border-2 bg-brand-surface shadow-[0_10px_30px_-12px_rgba(96,45,36,0.35)] transition-colors',
  ]
  if (finished) {
    parts.push('border-brand-border/55 !bg-[#f4f3f1] shadow-[0_4px_14px_-10px_rgba(96,45,36,0.2)]')
  } else {
    parts.push('border-brand-primary/40')
  }
  if (isCurrentGame && !finished) {
    parts.push('ring-2 ring-brand-accent/45')
  }
  if (isMyGame && !finished) {
    parts.push('ring-2 ring-brand-accent/70')
  }
  return parts.join(' ')
}

function isGameTimeUp(
  gameNumber: number,
  clock: number,
  roundTimesByGame?: Map<number, { startsAt: number; endsAt: number }>,
  roundStatusByGame?: Map<number, RoundStatus>,
): boolean {
  if (roundStatusByGame?.get(gameNumber) === 'complete') return true
  const times = roundTimesByGame?.get(gameNumber)
  return Boolean(times && clock >= times.endsAt)
}

function isGameSubmitted(
  game: ScoringGame,
  gameRoundId: string | undefined,
  courtsForGame: LiveCourt[],
  courtIdByLabel: Map<string, string> | undefined,
  matchForCourt: NonNullable<Props['matchForCourt']>,
): boolean {
  if (!gameRoundId) return false
  const courtIds: string[] = []
  if (courtsForGame.length > 0) {
    courtIds.push(...courtsForGame.map((c) => c.courtId))
  } else {
    game.courts.forEach((court, courtIndex) => {
      const id = courtIdForLabel(court.courtLabel, courtIndex, courtsForGame, courtIdByLabel)
      if (id) courtIds.push(id)
    })
  }
  if (courtIds.length === 0) return false
  return courtIds.every((courtId) => {
    const saved = matchForCourt(gameRoundId, courtId)
    return saved?.teamAPoints != null && saved?.teamBPoints != null
  })
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

function isGameLive(
  now: number,
  times: { startsAt: number; endsAt: number } | undefined,
): boolean {
  return Boolean(times && now >= times.startsAt && now < times.endsAt)
}

function gameCountdown(
  now: number,
  times: { startsAt: number; endsAt: number } | undefined,
  gameMinutes: number,
): string {
  const fullMs = gameMinutes * 60000
  if (!times) return formatCountdown(fullMs)
  if (now >= times.endsAt) return '0:00'
  if (now < times.startsAt) return formatCountdown(times.startsAt - now)
  return formatCountdown(times.endsAt - now)
}

function countdownState(
  now: number,
  times: { startsAt: number; endsAt: number } | undefined,
  finished: boolean,
): CountdownState {
  if (finished) return 'finished'
  if (!times) return 'scheduled'
  if (now < times.startsAt) return 'starts'
  if (now < times.endsAt) return 'playing'
  return 'finished'
}

function countdownLabel(state: CountdownState, t: TranslateFn): string {
  if (state === 'starts') return t('competition.startsIn')
  if (state === 'playing') return t('competition.timeLeft')
  if (state === 'finished') return t('competition.finished')
  return t('competition.gameTime')
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
  'text-center font-display text-2xl font-bold text-brand-accent md:text-3xl'
const CURRENT_PLAYER_HIGHLIGHT_CLASS =
  'animate-pulse rounded bg-brand-bg-alt px-1 text-brand-accent'

function courtLabelClass(
  currentUserId: string | null | undefined,
  court: Parameters<typeof courtHasCurrentUser>[1],
  finished = false,
) {
  const base = finished
    ? 'font-display text-2xl font-bold text-brand-sage md:text-3xl'
    : 'font-display text-2xl font-bold md:text-3xl'
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
    'w-full min-w-0 overflow-hidden rounded-xl border-2 bg-brand-surface shadow-[0_6px_18px_-8px_rgba(96,45,36,0.28)] transition',
  ]
  if (finished) {
    parts.push('border-brand-border/50 !bg-[#faf9f8] shadow-[0_2px_8px_-6px_rgba(96,45,36,0.15)]')
  } else {
    parts.push('border-brand-primary/35')
  }
  if (isMyCourt && !finished) {
    parts.push('ring-2 ring-brand-accent/35')
  }
  return parts.join(' ')
}

function CourtCard({
  courtLabel,
  courtRef,
  currentUserId,
  court,
  finished,
  href,
  statsHref,
  children,
  t,
}: {
  courtLabel: string
  courtRef?: CourtRef
  currentUserId?: string | null
  court: LiveCourt | ScoringGame['courts'][number]
  finished: boolean
  href?: string
  statsHref?: string
  children: ReactNode
  t: TranslateFn
}) {
  const navigate = useNavigate()
  const isMyCourt = courtHasCurrentUser(currentUserId, court)
  const shellClass = `${courtCardShellClass({ finished, isMyCourt })}${
    href
      ? ' cursor-pointer transition hover:border-brand-accent/45 active:scale-[0.99] active:opacity-95'
      : ''
  }`
  const body = (
    <>
      <div
        className={`border-b ${
          finished ? 'border-brand-border/40 bg-brand-surface' : 'border-brand-border/50 bg-brand-surface'
        }`}
      >
        <CourtLabelRow
          courtLabel={courtLabel}
          courtRef={courtRef}
          currentUserId={currentUserId}
          court={court}
          finished={finished}
          t={t}
        />
      </div>
      <div className="p-2 md:p-2.5">
        {children}
        {statsHref ? (
          <Link
            to={statsHref}
            onClick={(e) => e.stopPropagation()}
            className="brand-btn-outline mt-2 block w-full py-2 text-center text-xs font-semibold no-underline"
          >
            {t('pad.dashboard.stats')}
          </Link>
        ) : null}
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

function ScoreStepper({
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
    ? 'h-8 w-8 rounded-lg border border-brand-border/50 bg-[#faf9f7] px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-brand-sage disabled:text-brand-muted/60 md:h-10 md:w-10 md:text-base'
    : 'h-8 w-8 rounded-lg border border-brand-border/80 bg-brand-surface px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-brand-primary disabled:text-brand-muted/60 md:h-10 md:w-10 md:text-base'
  const stepClass =
    'flex h-5 w-8 items-center justify-center rounded text-[10px] font-bold leading-none text-brand-muted active:bg-brand-bg-alt disabled:opacity-30 md:h-6 md:w-10 md:text-xs'

  return (
    <div className="flex flex-col items-center gap-0.5">
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
        onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
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

function CourtMatchCell({
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
  currentUserId,
  currentUserAvatarUrl,
  embedded = false,
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
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  embedded?: boolean
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

  const playerEl = (player: CourtPlayer, align: 'left' | 'right') => {
    const isCurrent = Boolean(currentUserId && player.id === currentUserId)
    const isRegistered = Boolean(player.id)
    const displayAvatarUrl = isRegistered
      ? player.avatarUrl ?? (isCurrent ? currentUserAvatarUrl ?? null : null)
      : null
    const [displayName] = compactDisplayNames([player.name])
    const nameEl = (
      <span className="truncate text-lg font-semibold leading-tight text-brand-text md:text-xl">
        {displayName}
      </span>
    )
    const avatarEl = displayAvatarUrl ? (
      <img
        src={displayAvatarUrl}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-brand-border/60 md:h-9 md:w-9"
      />
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

  const grid = (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_1px_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 px-0.5 py-1 md:gap-x-3 md:px-1 md:py-1.5">
        <div className="min-w-0 justify-self-start space-y-1">
          {playerEl(teamAPlayerList[0]!, 'left')}
          {playerEl(teamAPlayerList[1]!, 'left')}
        </div>
        <div className="flex min-w-[1.25rem] items-center justify-center tabular-nums">
          {scoreAEl}
        </div>
        <span className="h-full min-h-[2.5rem] w-px bg-brand-border/60" aria-hidden="true" />
        <div className="flex min-w-[1.25rem] items-center justify-center tabular-nums">
          {scoreBEl}
        </div>
        <div className="min-w-0 justify-self-end space-y-1">
          {playerEl(teamBPlayerList[0]!, 'right')}
          {playerEl(teamBPlayerList[1]!, 'right')}
        </div>
      </div>
  )

  if (embedded) {
    return (
      <div aria-label={`${teamA[0]} and ${teamA[1]} against ${teamB[0]} and ${teamB[1]}`}>
        {grid}
      </div>
    )
  }

  return (
    <div
      className={
        finished
          ? 'overflow-hidden rounded-lg border border-brand-border/40 bg-[#f3f2f0]'
          : 'overflow-hidden rounded-lg border border-brand-border/60 bg-brand-surface'
      }
      aria-label={`${teamA[0]} and ${teamA[1]} against ${teamB[0]} and ${teamB[1]}`}
    >
      {grid}
    </div>
  )
}

type CourtDraft = { teamA: string; teamB: string }

function courtIdForLabel(
  courtLabel: string,
  courtIndex: number,
  courtsForGame: LiveCourt[],
  courtIdByLabel?: Map<string, string>,
): string | undefined {
  const live = courtsForGame.find(
    (c) =>
      c.courtName === courtLabel ||
      c.courtName.toLowerCase() === courtLabel.toLowerCase(),
  )?.courtId
  if (live) return live

  const exact = courtIdByLabel?.get(courtLabel)
  if (exact) return exact

  for (const [name, id] of courtIdByLabel ?? []) {
    if (name.toLowerCase() === courtLabel.toLowerCase()) return id
  }

  const ordered = [...(courtIdByLabel?.values() ?? [])]
  return ordered[courtIndex]
}

function scoreStringsForCourt(
  draft: CourtDraft | undefined,
  saved:
    | { teamAPoints?: number; teamBPoints?: number }
    | undefined,
  dirty: boolean,
): { teamAStr: string; teamBStr: string } {
  if (dirty && draft != null) {
    return { teamAStr: draft.teamA, teamBStr: draft.teamB }
  }
  return {
    teamAStr: effectiveScoreField(draft?.teamA, saved?.teamAPoints, false),
    teamBStr: effectiveScoreField(draft?.teamB, saved?.teamBPoints, false),
  }
}

type ScoringGame = ReturnType<typeof pivotScheduleByGame>[number]

function useGameScoring({
  game,
  gameRoundId,
  courtsForGame,
  courtIdByLabel,
  matchForCourt,
  canEdit,
  onSubmitScores,
  onSaved,
  t,
}: {
  game: ScoringGame
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt: NonNullable<Props['matchForCourt']>
  canEdit: boolean
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void
  t: TranslateFn
}) {
  const [drafts, setDrafts] = useState<Record<string, CourtDraft>>({})
  const [dirty, setDirty] = useState(false)
  const [busyCourtKey, setBusyCourtKey] = useState<string | null>(null)
  const [error, setError] = useState<{ courtId: string; message: string } | null>(null)

  const scoringCourts = useMemo(() => {
    if (!gameRoundId) return []
    if (courtsForGame.length > 0) {
      return courtsForGame.map((court) => ({
        courtId: court.courtId,
        courtLabel: court.courtName,
      }))
    }
    return game.courts.flatMap((court, courtIndex) => {
      const courtId = courtIdForLabel(
        court.courtLabel,
        courtIndex,
        courtsForGame,
        courtIdByLabel,
      )
      if (!courtId) return []
      return [{ courtId, courtLabel: court.courtLabel }]
    })
  }, [courtIdByLabel, courtsForGame, game.courts, gameRoundId])

  const savedSnapshot = useMemo(() => {
    if (!gameRoundId) return ''
    return scoringCourts
      .map(({ courtId }) => {
        const saved = matchForCourt(gameRoundId, courtId)
        return `${courtId}:${saved?.teamAPoints ?? ''}:${saved?.teamBPoints ?? ''}:${saved?.playedAt ?? ''}`
      })
      .join('|')
  }, [gameRoundId, matchForCourt, scoringCourts])

  useEffect(() => {
    if (!gameRoundId) return
    setDrafts((prev) => {
      const next = dirty ? { ...prev } : {}
      for (const { courtId } of scoringCourts) {
        if (dirty && prev[courtId]) continue
        const saved = matchForCourt(gameRoundId, courtId)
        next[courtId] = {
          teamA: saved?.teamAPoints != null ? String(saved.teamAPoints) : '',
          teamB: saved?.teamBPoints != null ? String(saved.teamBPoints) : '',
        }
      }
      return next
    })
  }, [dirty, gameRoundId, matchForCourt, savedSnapshot, scoringCourts])

  const setDraft = useCallback((courtId: string, side: 'teamA' | 'teamB', value: string) => {
    setDirty(true)
    setDrafts((prev) => ({
      ...prev,
      [courtId]: {
        teamA: prev[courtId]?.teamA ?? '',
        teamB: prev[courtId]?.teamB ?? '',
        [side]: scoreDigitsOnly(value),
      },
    }))
  }, [])

  const courtScoreRows = useMemo(() => {
    if (!gameRoundId) return []
    return scoringCourts.map(({ courtId, courtLabel }) => {
      const draft = drafts[courtId]
      const saved = matchForCourt(gameRoundId, courtId)
      const { teamAStr, teamBStr } = scoreStringsForCourt(draft, saved, dirty)
      const teamA = parseScoreField(teamAStr)
      const teamB = parseScoreField(teamBStr)
      const court = game.courts.find((c) => c.courtLabel === courtLabel)
      return { courtId, courtLabel, court, teamA, teamB, teamAStr, teamBStr, saved }
    })
  }, [dirty, drafts, game.courts, gameRoundId, matchForCourt, scoringCourts])

  const submitCourt = async (courtId: string) => {
    const row = courtScoreRows.find((r) => r.courtId === courtId)
    if (!onSubmitScores || !gameRoundId || !row || row.teamA === null || row.teamB === null) return
    setBusyCourtKey(courtId)
    setError(null)
    try {
      await onSubmitScores([
        {
          roundId: gameRoundId,
          courtId,
          teamA: row.teamA,
          teamB: row.teamB,
        },
      ])
      setDirty(false)
      onSaved?.()
    } catch (e) {
      setError({
        courtId,
        message: e instanceof Error ? e.message : t('common.submitFailed'),
      })
    } finally {
      setBusyCourtKey(null)
    }
  }

  return { courtScoreRows, setDraft, submitCourt, busyCourtKey, error, canEdit, dirty }
}

function useFriendlyManualScoring({
  game,
  liveCourtScores,
  canEdit,
  onSubmit,
  onSaved,
  t,
}: {
  game: ScoringGame
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  canEdit: boolean
  onSubmit?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void
  t: TranslateFn
}) {
  const courts = useMemo(
    () =>
      game.courts.map((court) => ({
        courtKey: liveCourtScoreKey(game.gameNumber, court.courtLabel),
        courtLabel: court.courtLabel,
        court,
      })),
    [game.courts, game.gameNumber],
  )

  const savedSnapshot = useMemo(
    () =>
      courts
        .map(({ courtKey }) => {
          const live = liveCourtScores?.get(courtKey)
          return `${courtKey}:${live?.scoreA ?? ''}:${live?.scoreB ?? ''}`
        })
        .join('|'),
    [courts, liveCourtScores],
  )

  const [drafts, setDrafts] = useState<Record<string, CourtDraft>>({})
  const [dirty, setDirty] = useState(false)
  const [busyCourtKey, setBusyCourtKey] = useState<string | null>(null)
  const [error, setError] = useState<{ courtKey: string; message: string } | null>(null)

  useEffect(() => {
    setDrafts((prev) => {
      const next = dirty ? { ...prev } : {}
      for (const { courtKey } of courts) {
        if (dirty && prev[courtKey]) continue
        const live = liveCourtScores?.get(courtKey)
        next[courtKey] = {
          teamA: live?.scoreA ?? '',
          teamB: live?.scoreB ?? '',
        }
      }
      return next
    })
  }, [courts, dirty, liveCourtScores, savedSnapshot])

  const setDraft = useCallback((courtKey: string, side: 'teamA' | 'teamB', value: string) => {
    setDirty(true)
    setDrafts((prev) => ({
      ...prev,
      [courtKey]: {
        teamA: prev[courtKey]?.teamA ?? '',
        teamB: prev[courtKey]?.teamB ?? '',
        [side]: scoreDigitsOnly(value),
      },
    }))
  }, [])

  const courtScoreRows = useMemo(() => {
    return courts.map(({ courtKey, courtLabel, court }) => {
      const draft = drafts[courtKey]
      const live = liveCourtScores?.get(courtKey)
      const saved = live
        ? {
            teamAPoints: live.scoreA !== '' ? Number(live.scoreA) : undefined,
            teamBPoints: live.scoreB !== '' ? Number(live.scoreB) : undefined,
          }
        : undefined
      const { teamAStr, teamBStr } = scoreStringsForCourt(draft, saved, dirty)
      const teamA = parseScoreField(teamAStr)
      const teamB = parseScoreField(teamBStr)
      return { courtKey, courtLabel, court, teamA, teamB, teamAStr, teamBStr }
    })
  }, [courts, dirty, drafts, liveCourtScores])

  const submitCourt = async (courtKey: string) => {
    const row = courtScoreRows.find((r) => r.courtKey === courtKey)
    if (!onSubmit || !row || row.teamA === null || row.teamB === null) return
    setBusyCourtKey(courtKey)
    setError(null)
    try {
      await onSubmit([
        {
          gameNumber: game.gameNumber,
          courtLabel: row.courtLabel,
          teamA: row.teamA,
          teamB: row.teamB,
          teamAPlayers: row.court.teamAPlayers,
          teamBPlayers: row.court.teamBPlayers,
        },
      ])
      setDirty(false)
      onSaved?.()
    } catch (e) {
      setError({
        courtKey,
        message: e instanceof Error ? e.message : t('common.submitFailed'),
      })
    } finally {
      setBusyCourtKey(null)
    }
  }

  return { courtScoreRows, setDraft, submitCourt, busyCourtKey, error, canEdit, dirty }
}

function GameScoringCourts({
  game,
  courtsForGame,
  scoreUnit,
  courtScoreRows,
  setDraft,
  submitCourt,
  busyCourtKey,
  courtError,
  canEdit,
  finished,
  currentUserId,
  currentUserAvatarUrl,
  liveCourtEnabled,
  friendly,
  sessionId,
  competitionId,
  courtRefs,
  playTo,
  t,
}: {
  game: ScoringGame
  courtsForGame: LiveCourt[]
  scoreUnit: AmericanoScoringUnit
  courtScoreRows: ReturnType<typeof useGameScoring>['courtScoreRows']
  setDraft: (courtId: string, side: 'teamA' | 'teamB', value: string) => void
  submitCourt?: (courtId: string) => Promise<void>
  busyCourtKey?: string | null
  courtError?: { courtId: string; message: string } | null
  canEdit: boolean
  finished: boolean
  playTo?: number
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  liveCourtEnabled: boolean
  friendly: boolean
  sessionId?: string
  competitionId?: string
  courtRefs?: CourtRefsLookup
  t: TranslateFn
}) {
  return (
    <div className="space-y-3">
      {courtScoreRows.map((row, courtIndex) => {
        const liveCourt = courtsForGame.find((c) => c.courtName === row.courtLabel)
        const courtId = row.courtId
        const court = row.court
        if (!court) return null
        const teamA = liveCourt?.teamA ?? court.teamA
        const teamB = liveCourt?.teamB ?? court.teamB
        const teamAPlayers = liveCourt?.teamAPlayers ?? court.teamAPlayers
        const teamBPlayers = liveCourt?.teamBPlayers ?? court.teamBPlayers
        const courtReady = row.teamA !== null && row.teamB !== null

        const href = courtLiveHref({
          liveCourtEnabled,
          friendly,
          sessionId,
          competitionId,
          gameNumber: game.gameNumber,
          courtLabel: row.courtLabel,
          courtId,
          canEditScores: canEdit,
        })
        const statsHref = courtStatsHref(
          friendly,
          sessionId,
          game.gameNumber,
          row.courtLabel,
        )

        return (
          <CourtCard
            key={row.courtLabel}
            courtLabel={row.courtLabel}
            courtRef={resolveCourtRef(row.courtLabel, courtIndex, courtRefs)}
            currentUserId={currentUserId}
            court={liveCourt ?? court}
            finished={finished}
            href={href}
            statsHref={statsHref}
            t={t}
          >
            <CourtMatchCell
              teamA={teamA}
              teamB={teamB}
              teamAPlayers={teamAPlayers}
              teamBPlayers={teamBPlayers}
              scoreUnit={scoreUnit}
              scoreA={row.teamAStr}
              scoreB={row.teamBStr}
              onScoreA={canEdit && courtId ? (v) => setDraft(courtId, 'teamA', v) : undefined}
              onScoreB={canEdit && courtId ? (v) => setDraft(courtId, 'teamB', v) : undefined}
              disabled={!canEdit}
              finished={finished}
              scoreMax={playTo}
              currentUserId={currentUserId}
              currentUserAvatarUrl={currentUserAvatarUrl}
              embedded
              t={t}
            />
            {canEdit && submitCourt ? (
              <>
                <button
                  type="button"
                  disabled={busyCourtKey === courtId || !courtReady}
                  onClick={() => void submitCourt(courtId)}
                  className="brand-btn mt-2 w-full py-2 text-xs font-semibold disabled:opacity-40"
                >
                  {busyCourtKey === courtId ? '…' : t('common.submit')}
                </button>
                {courtError?.courtId === courtId ? (
                  <p className="mt-1 text-center text-xs text-red-600">{courtError.message}</p>
                ) : null}
              </>
            ) : null}
          </CourtCard>
        )
      })}
    </div>
  )
}

function CourtLabelRow({
  courtLabel,
  courtRef,
  currentUserId,
  court,
  finished,
  t,
}: {
  courtLabel: string
  courtRef?: CourtRef
  currentUserId?: string | null
  court: LiveCourt | ScoringGame['courts'][number]
  finished: boolean
  t: TranslateFn
}) {
  const label = displayCourtLabel(courtLabel, t)
  const titleClass = `${courtLabelClass(currentUserId, court, finished)} text-left`
  const refInitial = courtRef?.displayName ? firstDisplayName(courtRef.displayName).charAt(0) : ''
  return (
    <div className="flex min-h-12 items-center gap-2 px-3 py-2">
      <p className={`min-w-0 flex-1 truncate ${titleClass}`}>{label}</p>
      {courtRef ? (
        <div className="flex shrink-0 items-center gap-2">
          <div className="min-w-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
              {t('court.ref')}
            </p>
            <p className="max-w-[9rem] truncate text-sm font-semibold text-brand-primary sm:max-w-[11rem] md:max-w-none md:text-base">
              {firstDisplayName(courtRef.displayName)}
            </p>
          </div>
          {courtRef.avatarUrl ? (
            <img
              src={courtRef.avatarUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-brand-accent/45 md:h-11 md:w-11"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 font-display text-sm font-bold text-brand-primary md:h-11 md:w-11 md:text-base"
            >
              {refInitial}
            </span>
          )}
        </div>
      ) : null}
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-border/80 bg-brand-bg-alt text-brand-accent transition hover:border-brand-accent/50 hover:bg-brand-surface active:scale-95 md:h-11 md:w-11"
        aria-label={t('court.scoreTrackerAria')}
        title={t('court.scoreTrackerAria')}
        onClick={(e) => e.stopPropagation()}
      >
        <ScoreTrackerIcon className="h-5 w-5 md:h-6 md:w-6" />
      </button>
    </div>
  )
}

function courtLiveHref({
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

function courtStatsHref(
  friendly: boolean,
  sessionId: string | undefined,
  gameNumber: number,
  courtLabel: string,
): string | undefined {
  if (!friendly || !sessionId) return undefined
  return friendlyCourtLivePath(sessionId, gameNumber, courtLabel)
}

function GameCardHeader({
  gameNumber,
  isLiveNow,
  timeLabel,
  countdown,
  countdownLabelText,
  finished,
  collapsed,
  onToggleCollapsed,
  t,
}: {
  gameNumber: number
  isLiveNow?: boolean
  timeLabel?: string
  countdown?: string | null
  countdownLabelText: string
  finished: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  t: TranslateFn
}) {
  return (
    <div
      className={`flex items-stretch border-b-2 ${
        finished
          ? 'border-brand-border/50 bg-[#e8e7e5]'
          : 'border-brand-accent/50 bg-brand-primary'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3.5 md:gap-3 md:px-4 md:py-4">
        <p
          className={`shrink-0 font-display text-2xl font-bold leading-none tabular-nums md:text-3xl ${
            finished ? 'text-brand-sage' : 'text-brand-accent-light'
          }`}
        >
          {t('competition.game', { number: gameNumber })}
        </p>
        <div className="min-w-0 flex-1">
          {isLiveNow ? (
            <span
              className={`text-xs font-semibold md:text-sm ${
                finished ? 'text-brand-accent' : 'text-brand-bg-alt'
              }`}
            >
              {t('competition.live')}
            </span>
          ) : finished ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-muted md:text-sm">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-sage/60" aria-hidden />
              {t('competition.done')}
            </span>
          ) : null}
          {timeLabel ? (
            <span
              className={`mt-0.5 block text-[11px] tabular-nums md:text-sm ${
                finished ? 'text-brand-muted' : 'text-white/75'
              }`}
            >
              {timeLabel}
            </span>
          ) : null}
        </div>
        {countdown ? (
          <div className="shrink-0 text-right" aria-live="polite">
            <p
              className={`text-[10px] font-semibold uppercase tracking-wide md:text-xs ${
                finished ? 'text-brand-muted' : 'text-white/65'
              }`}
            >
              {countdownLabelText}
            </p>
            <p
              className={`font-display text-2xl font-bold leading-none tabular-nums md:text-3xl ${
                finished ? 'text-brand-primary' : 'text-brand-bg-alt'
              }`}
            >
              {countdown}
            </p>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        className={`flex min-w-12 shrink-0 items-center justify-center self-stretch border-l px-4 text-2xl leading-none transition active:opacity-70 md:min-w-14 md:px-5 md:text-3xl ${
          finished
            ? 'border-brand-border/50 text-brand-sage/80'
            : 'border-white/25 text-brand-bg-alt'
        }`}
      >
        {collapsed ? '▸' : '▾'}
      </button>
    </div>
  )
}

function ScoringGameCard({
  game,
  liveCourtEnabled,
  friendly,
  sessionId,
  competitionId,
  courtRefs,
  gameRoundId,
  courtsForGame,
  courtIdByLabel,
  matchForCourt,
  scoreUnit,
  playTo,
  canEdit,
  onSubmitScores,
  onSaved,
  isLiveNow,
  isCurrentGame,
  countdown,
  countdownLabelText,
  finished,
  collapsed,
  onToggleCollapsed,
  currentUserId,
  currentUserAvatarUrl,
  t,
}: {
  game: ScoringGame
  liveCourtEnabled: boolean
  friendly: boolean
  sessionId?: string
  competitionId?: string
  courtRefs?: CourtRefsLookup
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt: NonNullable<Props['matchForCourt']>
  scoreUnit: AmericanoScoringUnit
  playTo?: number
  canEdit: boolean
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void
  isLiveNow: boolean
  isCurrentGame: boolean
  countdown?: string | null
  countdownLabelText: string
  finished: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  t: TranslateFn
}) {
  const { courtScoreRows, setDraft, submitCourt, busyCourtKey, error, canEdit: editable } =
    useGameScoring({
    game,
    gameRoundId,
    courtsForGame,
    courtIdByLabel,
    matchForCourt,
    canEdit,
    onSubmitScores,
    onSaved,
    t,
  })

  const isMyGame = Boolean(
    currentUserId &&
      courtsForGame.some(
        (court) =>
          court.teamAPlayers?.some((player) => player.id === currentUserId) ||
          court.teamBPlayers?.some((player) => player.id === currentUserId) ||
          court.playerIds.includes(currentUserId),
      ),
  )

  return (
    <div id={`game-${game.gameNumber}`} className={gameCardShellClass({ finished, isCurrentGame, isMyGame })}>
      <GameCardHeader
        gameNumber={game.gameNumber}
        isLiveNow={isLiveNow}
        timeLabel={game.timeLabel}
        countdown={countdown}
        countdownLabelText={countdownLabelText}
        finished={finished}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        t={t}
      />
      {!collapsed && (
        <div
          className={`border-t px-3 pb-3.5 pt-3 md:px-4 ${
            finished ? 'border-brand-border/40 bg-brand-bg-alt/70' : 'border-brand-border/30 bg-brand-bg-alt'
          }`}
        >
          <GameScoringCourts
            game={game}
            courtsForGame={courtsForGame}
            scoreUnit={scoreUnit}
            playTo={playTo}
            courtScoreRows={courtScoreRows}
            setDraft={setDraft}
            submitCourt={onSubmitScores ? submitCourt : undefined}
            busyCourtKey={busyCourtKey}
            courtError={error}
            canEdit={editable}
            finished={finished}
            currentUserId={currentUserId}
            currentUserAvatarUrl={currentUserAvatarUrl}
            liveCourtEnabled={liveCourtEnabled}
            friendly={friendly}
            sessionId={sessionId}
            competitionId={competitionId}
            courtRefs={courtRefs}
            t={t}
          />
        </div>
      )}
    </div>
  )
}

function FriendlyManualGameCard({
  sessionId,
  game,
  scoreUnit,
  liveCourtScores,
  courtRefs,
  onSubmitFriendlyScores,
  onSaved,
  isLiveNow,
  isCurrentGame,
  countdown,
  countdownLabelText,
  finished,
  collapsed,
  onToggleCollapsed,
  currentUserId,
  currentUserAvatarUrl,
  t,
}: {
  sessionId?: string
  game: ScoringGame
  scoreUnit: AmericanoScoringUnit
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  courtRefs?: CourtRefsLookup
  onSubmitFriendlyScores?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void
  isLiveNow: boolean
  isCurrentGame: boolean
  countdown?: string | null
  countdownLabelText: string
  finished: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  t: TranslateFn
}) {
  const { courtScoreRows, setDraft, submitCourt, busyCourtKey, error, canEdit } = useFriendlyManualScoring({
    game,
    liveCourtScores,
    canEdit: Boolean(onSubmitFriendlyScores),
    onSubmit: onSubmitFriendlyScores,
    onSaved,
    t,
  })

  return (
    <div id={`game-${game.gameNumber}`} className={gameCardShellClass({ finished, isCurrentGame })}>
      <GameCardHeader
        gameNumber={game.gameNumber}
        isLiveNow={isLiveNow}
        timeLabel={game.timeLabel}
        countdown={countdown}
        countdownLabelText={countdownLabelText}
        finished={finished}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        t={t}
      />
      {!collapsed && (
        <>
          <div className="border-t border-brand-border/30 bg-brand-bg-alt px-3 pb-3.5 pt-3 md:px-4">
            <div className="space-y-3.5">
              {courtScoreRows.map((row, courtIndex) => {
                const teamA = row.court.teamA
                const teamB = row.court.teamB
                const courtReady = row.teamA !== null && row.teamB !== null
                return (
                  <CourtCard
                    key={row.courtLabel}
                    courtLabel={row.courtLabel}
                    courtRef={resolveCourtRef(row.courtLabel, courtIndex, courtRefs)}
                    currentUserId={currentUserId}
                    court={row.court}
                    finished={finished}
                    statsHref={courtStatsHref(true, sessionId, game.gameNumber, row.courtLabel)}
                    t={t}
                  >
                    <CourtMatchCell
                      teamA={teamA}
                      teamB={teamB}
                      teamAPlayers={row.court.teamAPlayers}
                      teamBPlayers={row.court.teamBPlayers}
                      scoreUnit={scoreUnit}
                      scoreA={row.teamAStr}
                      scoreB={row.teamBStr}
                      onScoreA={canEdit ? (v) => setDraft(row.courtKey, 'teamA', v) : undefined}
                      onScoreB={canEdit ? (v) => setDraft(row.courtKey, 'teamB', v) : undefined}
                      disabled={!canEdit}
                      finished={finished}
                      currentUserId={currentUserId}
                      currentUserAvatarUrl={currentUserAvatarUrl}
                      embedded
                      t={t}
                    />
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          disabled={busyCourtKey === row.courtKey || !courtReady}
                          onClick={() => void submitCourt(row.courtKey)}
                          className="brand-btn mt-2 w-full py-2 text-xs font-semibold disabled:opacity-40"
                        >
                          {busyCourtKey === row.courtKey ? '…' : t('common.submit')}
                        </button>
                        {error?.courtKey === row.courtKey ? (
                          <p className="mt-1 text-center text-xs text-red-600">{error.message}</p>
                        ) : null}
                      </>
                    ) : null}
                  </CourtCard>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function CompetitionCourtBoard({
  competitionId,
  friendlySessionId,
  friendly = false,
  columns,
  mode,
  activeGameNumber,
  scoreUnit = 'sets',
  playTo,
  roundId,
  liveCourtsByGame,
  canLog,
  roundIdForGame,
  courtIdByLabel,
  matchForCourt,
  onSubmitScores,
  onSubmitFriendlyScores,
  onSaved,
  now,
  gameMinutes = RANKED_GAME_MINUTES,
  roundTimesByGame,
  roundStatusByGame,
  currentUserId,
  currentUserAvatarUrl,
  isAdmin = false,
  courtRefs,
  liveCourtScores,
}: Props) {
  const { t } = useTranslation()
  const games = useMemo(() => pivotScheduleByGame(columns), [columns])
  const [tick, setTick] = useState(() => Date.now())
  const [collapsedGames, setCollapsedGames] = useState<Record<number, boolean>>({})
  const sessionId = friendlySessionId ?? competitionId
  const liveCourtEnabled = Boolean(
    sessionId && isAdmin && currentUserId && !(friendly && onSubmitFriendlyScores),
  )
  const friendlyManualScoring = Boolean(friendly && isAdmin && onSubmitFriendlyScores)
  const scoringTimeUnlocked = isScoringTimeUnlocked()

  const previewTimed = mode === 'preview' && Boolean(roundTimesByGame?.size)

  useEffect(() => {
    if (mode !== 'scoring' && !previewTimed) return
    const t = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [mode, previewTimed])

  const clock = mode === 'scoring' || previewTimed ? tick : (now ?? tick)
  const prevRemainingMsRef = useRef(new Map<number, number>())
  const alarmedGamesRef = useRef(new Set<number>())

  useEffect(() => {
    if (mode !== 'scoring' || !roundTimesByGame) return
    for (const game of games) {
      const times = roundTimesByGame.get(game.gameNumber)
      if (!times || !isGameLive(clock, times)) continue
      if (isGameTimeUp(game.gameNumber, clock, roundTimesByGame, roundStatusByGame)) continue

      const remaining = times.endsAt - clock
      const prev = prevRemainingMsRef.current.get(game.gameNumber)
      prevRemainingMsRef.current.set(game.gameNumber, remaining)

      const crossedTwoMin =
        prev !== undefined && prev > TWO_MINUTES_MS && remaining <= TWO_MINUTES_MS
      if (!crossedTwoMin || alarmedGamesRef.current.has(game.gameNumber)) continue

      alarmedGamesRef.current.add(game.gameNumber)
      playTwoMinuteAlarm()
    }
  }, [clock, games, mode, roundStatusByGame, roundTimesByGame])

  const orderedGames = useMemo(() => {
    if (!roundTimesByGame?.size) return games
    return [...games].sort((a, b) => {
      const aStart = roundTimesByGame.get(a.gameNumber)?.startsAt ?? a.gameNumber
      const bStart = roundTimesByGame.get(b.gameNumber)?.startsAt ?? b.gameNumber
      return aStart - bStart
    })
  }, [games, roundTimesByGame])

  const toggleCollapsed = (gameNumber: number, defaultCollapsed: boolean) => {
    setCollapsedGames((prev) => ({
      ...prev,
      [gameNumber]: !(prev[gameNumber] ?? defaultCollapsed),
    }))
  }

  return (
    <div className="space-y-6">
      {orderedGames.map((game) => {
        const isActive = activeGameNumber === game.gameNumber
        const times = roundTimesByGame?.get(game.gameNumber)
        const roundStatus = roundStatusByGame?.get(game.gameNumber)
        const courtsForGame = liveCourtsByGame?.get(game.gameNumber) ?? []
        const gameRoundId =
          roundIdForGame?.(game.gameNumber) ?? (isActive ? roundId : undefined)
        const timedMode = mode === 'scoring' || previewTimed
        const isLiveNow = timedMode && isGameLive(clock, times)
        const timeUp = isGameTimeUp(
          game.gameNumber,
          clock,
          roundTimesByGame,
          roundStatusByGame,
        )
        const submitted =
          matchForCourt != null
            ? isGameSubmitted(game, gameRoundId, courtsForGame, courtIdByLabel, matchForCourt)
            : previewTimed
              ? timeUp
              : timeUp && roundStatus === 'complete'
        const finished = submitted
        const countdown =
          timedMode && !submitted && times
            ? gameCountdown(clock, times, gameMinutes)
            : null
        const state = countdownState(clock, times, timeUp)
        const collapsed = collapsedGames[game.gameNumber] ?? (scoringTimeUnlocked ? false : submitted)
        const isCurrentGame = !submitted && (isLiveNow || isActive)
        const canEditGame =
          Boolean(canLog) &&
          (scoringTimeUnlocked ||
            roundStatus === 'active' ||
            roundStatus === 'complete' ||
            isLiveNow ||
            timeUp)

        if (mode === 'scoring' && matchForCourt) {
          return (
            <ScoringGameCard
              key={game.gameNumber}
              game={game}
              liveCourtEnabled={liveCourtEnabled}
              friendly={friendly}
              sessionId={sessionId}
              competitionId={competitionId}
              courtRefs={courtRefs}
              gameRoundId={gameRoundId}
              courtsForGame={courtsForGame}
              courtIdByLabel={courtIdByLabel}
              matchForCourt={matchForCourt}
              scoreUnit={scoreUnit}
              playTo={playTo}
              canEdit={canEditGame}
              onSubmitScores={onSubmitScores}
              onSaved={onSaved}
              isLiveNow={isLiveNow}
              isCurrentGame={isCurrentGame}
              countdown={countdown}
              countdownLabelText={countdownLabel(state, t)}
              finished={finished}
              collapsed={collapsed}
              onToggleCollapsed={() => toggleCollapsed(game.gameNumber, finished)}
              currentUserId={currentUserId}
              currentUserAvatarUrl={currentUserAvatarUrl}
              t={t}
            />
          )
        }

        if (mode === 'preview' && friendlyManualScoring) {
          return (
            <FriendlyManualGameCard
              key={game.gameNumber}
              sessionId={friendlySessionId}
              game={game}
              scoreUnit={scoreUnit}
              liveCourtScores={liveCourtScores}
              courtRefs={courtRefs}
              onSubmitFriendlyScores={onSubmitFriendlyScores}
              onSaved={onSaved}
              isLiveNow={isLiveNow}
              isCurrentGame={isCurrentGame}
              countdown={countdown}
              countdownLabelText={countdownLabel(state, t)}
              finished={finished}
              collapsed={collapsed}
              onToggleCollapsed={() => toggleCollapsed(game.gameNumber, finished)}
              currentUserId={currentUserId}
              currentUserAvatarUrl={currentUserAvatarUrl}
              t={t}
            />
          )
        }

        return (
          <div
            key={game.gameNumber}
            id={`game-${game.gameNumber}`}
            className={gameCardShellClass({ finished, isCurrentGame })}
          >
            <GameCardHeader
              gameNumber={game.gameNumber}
              isLiveNow={isLiveNow}
              timeLabel={game.timeLabel}
              countdown={countdown}
              countdownLabelText={countdownLabel(state, t)}
              finished={finished}
              collapsed={collapsed}
              onToggleCollapsed={() => toggleCollapsed(game.gameNumber, finished)}
              t={t}
            />
            {!collapsed && (
              <div
                className={`border-t px-3 pb-3.5 pt-3 md:px-4 ${
                  finished ? 'border-brand-border/40 bg-brand-bg-alt/70' : 'border-brand-border/30 bg-brand-bg-alt'
                }`}
              >
              <div className="space-y-3.5">
                {game.courts.map((court, courtIndex) => {
                  const liveCourt = courtsForGame.find((c) => c.courtName === court.courtLabel)
                  const courtId = courtIdForLabel(
                    court.courtLabel,
                    courtIndex,
                    courtsForGame,
                    courtIdByLabel,
                  )
                  const saved =
                    gameRoundId && courtId && matchForCourt
                      ? matchForCourt(gameRoundId, courtId)
                      : undefined
                  const liveScore = liveCourtScores?.get(
                    liveCourtScoreKey(game.gameNumber, court.courtLabel),
                  )
                  const teamA = liveCourt?.teamA ?? court.teamA
                  const teamB = liveCourt?.teamB ?? court.teamB
                  const teamAPlayers = liveCourt?.teamAPlayers ?? court.teamAPlayers
                  const teamBPlayers = liveCourt?.teamBPlayers ?? court.teamBPlayers
                  const href = courtLiveHref({
                    liveCourtEnabled,
                    friendly,
                    sessionId,
                    competitionId,
                    gameNumber: game.gameNumber,
                    courtLabel: court.courtLabel,
                    courtId,
                    canEditScores: false,
                  })

                  const statsHref = courtStatsHref(
                    friendly,
                    sessionId,
                    game.gameNumber,
                    court.courtLabel,
                  )

                  return (
                    <CourtCard
                      key={court.courtLabel}
                      courtLabel={court.courtLabel}
                      courtRef={resolveCourtRef(court.courtLabel, courtIndex, courtRefs)}
                      currentUserId={currentUserId}
                      court={liveCourt ?? court}
                      finished={finished}
                      href={href}
                      statsHref={statsHref}
                      t={t}
                    >
                      <CourtMatchCell
                        teamA={teamA}
                        teamB={teamB}
                        teamAPlayers={teamAPlayers}
                        teamBPlayers={teamBPlayers}
                        scoreUnit={scoreUnit}
                        scoreA={liveScore?.scoreA ?? (saved?.teamAPoints != null ? String(saved.teamAPoints) : undefined)}
                        scoreB={liveScore?.scoreB ?? (saved?.teamBPoints != null ? String(saved.teamBPoints) : undefined)}
                        scoreMax={playTo}
                        disabled
                        finished={finished}
                        currentUserId={currentUserId}
                        currentUserAvatarUrl={currentUserAvatarUrl}
                        embedded
                        t={t}
                      />
                    </CourtCard>
                  )
                })}
              </div>
            </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
