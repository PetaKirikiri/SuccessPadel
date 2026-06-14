import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { displayCourtLabel } from '../lib/courtDisplay'
import { liveCourtScoreKey, type LiveCourtGamesScore } from '../lib/liveCourtScore'
import { useTranslation } from '../hooks/useTranslation'
import type { TranslateFn } from '../i18n'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { formatGameTimeLabel, pivotScheduleByGame, type CourtColumn } from '../lib/competitionCourtBoard'
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
import { compactDisplayNames } from '../lib/leaderboardEntries'
import type { CourtPlayer } from '../lib/americanoSchedule'
import type { FriendlyCourtScoreSubmit } from '../lib/friendlyManualScore'
import type { MatchTeam } from '../lib/types'
import { PlayerNameLink } from './PlayerNameLink'

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
  onSaved?: () => void | Promise<void>
  now?: number
  gameMinutes?: number
  roundTimesByGame?: Map<number, { startsAt: number; endsAt: number }>
  roundStatusByGame?: Map<number, 'pending' | 'active' | 'complete'>
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  isAdmin?: boolean
  liveCourtScores?: Map<string, LiveCourtGamesScore>
}

type RoundStatus = 'pending' | 'active' | 'complete'
type CountdownState = 'starts' | 'playing' | 'finished' | 'scheduled'

function gameCardShellClass({
  finished,
  isMyGame = false,
}: {
  finished: boolean
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
  if (isMyGame && !finished) {
    parts.push('ring-2 ring-brand-accent/70')
  }
  return parts.join(' ')
}

function GameCardShell({
  gameNumber,
  finished,
  isCurrentGame,
  isMyGame = false,
  children,
}: {
  gameNumber: number
  finished: boolean
  isCurrentGame: boolean
  isMyGame?: boolean
  children: ReactNode
}) {
  const shellClass = gameCardShellClass({ finished, isMyGame })
  const live = isCurrentGame && !finished

  if (live) {
    return (
      <div id={`game-${gameNumber}`} className="game-card-racetrack rounded-2xl">
        <div className={`${shellClass} !rounded-[14px]`}>{children}</div>
      </div>
    )
  }

  return (
    <div id={`game-${gameNumber}`} className={shellClass}>
      {children}
    </div>
  )
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

function gameIsFinished(
  game: ScoringGame,
  {
    previewTimed,
    activeGameNumber,
    roundId,
    roundIdForGame,
    liveCourtsByGame,
    courtIdByLabel,
    matchForCourt,
    clock,
    roundTimesByGame,
    roundStatusByGame,
  }: {
    mode: Props['mode']
    previewTimed: boolean
    activeGameNumber?: number
    roundId?: string
    roundIdForGame?: Props['roundIdForGame']
    liveCourtsByGame?: Map<number, LiveCourt[]>
    courtIdByLabel?: Map<string, string>
    matchForCourt?: Props['matchForCourt']
    clock: number
    roundTimesByGame?: Map<number, { startsAt: number; endsAt: number }>
    roundStatusByGame?: Map<number, RoundStatus>
  },
): boolean {
  const isActive = activeGameNumber === game.gameNumber
  const roundStatus = roundStatusByGame?.get(game.gameNumber)
  const courtsForGame = liveCourtsByGame?.get(game.gameNumber) ?? []
  const gameRoundId =
    roundIdForGame?.(game.gameNumber) ?? (isActive ? roundId : undefined)
  const timeUp = isGameTimeUp(
    game.gameNumber,
    clock,
    roundTimesByGame,
    roundStatusByGame,
  )
  if (matchForCourt != null) {
    return isGameSubmitted(game, gameRoundId, courtsForGame, courtIdByLabel, matchForCourt)
  }
  if (previewTimed) return timeUp
  return timeUp && roundStatus === 'complete'
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
    ? 'text-center font-display text-2xl font-bold text-brand-sage md:text-3xl'
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
  currentUserId,
  court,
  finished,
  href,
  children,
  t,
}: {
  courtLabel: string
  currentUserId?: string | null
  court: LiveCourt | ScoringGame['courts'][number]
  finished: boolean
  href?: string
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
          currentUserId={currentUserId}
          court={court}
          finished={finished}
          t={t}
        />
      </div>
      <div className="p-2 md:p-2.5" onClick={href ? stopCardNav : undefined} onKeyDown={href ? stopCardNav : undefined}>
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
      <PlayerNameLink
        displayName={displayName}
        profileId={player.id}
        padelPlayerId={player.padelPlayerId}
        className="truncate text-lg font-semibold leading-tight text-brand-text md:text-xl"
      />
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

function courtScoresReady(teamAStr: string, teamBStr: string): boolean {
  return parseScoreField(teamAStr) !== null && parseScoreField(teamBStr) !== null
}

function courtSubmitReady(
  teamAStr: string,
  teamBStr: string,
  saved?: { teamAPoints?: number; teamBPoints?: number },
): boolean {
  if (!courtScoresReady(teamAStr, teamBStr)) return false
  const teamA = parseScoreField(teamAStr)!
  const teamB = parseScoreField(teamBStr)!
  if (saved?.teamAPoints == null && saved?.teamBPoints == null) return true
  return saved?.teamAPoints !== teamA || saved?.teamBPoints !== teamB
}

function stopCardNav(e: { stopPropagation: () => void }) {
  e.stopPropagation()
}

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
    return {
      teamAStr: draft.teamA ?? '',
      teamBStr: draft.teamB ?? '',
    }
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
  onSaved?: () => void | Promise<void>
  t: TranslateFn
}) {
  const [drafts, setDrafts] = useState<Record<string, CourtDraft>>({})
  const [dirtyCourts, setDirtyCourts] = useState<Set<string>>(() => new Set())
  const [busyCourtKey, setBusyCourtKey] = useState<string | null>(null)
  const [error, setError] = useState<{ courtId: string; message: string } | null>(null)

  const scoringCourts = useMemo(() => {
    if (!gameRoundId) return []
    const liveByName = new Map(courtsForGame.map((court) => [court.courtName, court]))
    return game.courts.flatMap((court, courtIndex) => {
      const live = liveByName.get(court.courtLabel)
      const courtId =
        live?.courtId ??
        courtIdForLabel(court.courtLabel, courtIndex, courtsForGame, courtIdByLabel)
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
      const next = { ...prev }
      for (const { courtId } of scoringCourts) {
        if (dirtyCourts.has(courtId) && prev[courtId]) continue
        const saved = matchForCourt(gameRoundId, courtId)
        next[courtId] = {
          teamA: saved?.teamAPoints != null ? String(saved.teamAPoints) : '',
          teamB: saved?.teamBPoints != null ? String(saved.teamBPoints) : '',
        }
      }
      return next
    })
  }, [dirtyCourts, gameRoundId, matchForCourt, savedSnapshot, scoringCourts])

  const setDraft = useCallback((courtId: string, side: 'teamA' | 'teamB', value: string) => {
    setDirtyCourts((prev) => new Set(prev).add(courtId))
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
      const isDirty = dirtyCourts.has(courtId)
      const { teamAStr, teamBStr } = scoreStringsForCourt(draft, saved, isDirty)
      const teamA = parseScoreField(teamAStr)
      const teamB = parseScoreField(teamBStr)
      const court = game.courts.find((c) => c.courtLabel === courtLabel)
      const canSubmit = courtSubmitReady(teamAStr, teamBStr, saved)
      return { courtId, courtLabel, court, teamA, teamB, teamAStr, teamBStr, saved, canSubmit }
    })
  }, [dirtyCourts, drafts, game.courts, gameRoundId, matchForCourt, scoringCourts])

  const submitCourt = async (courtId: string) => {
    const row = courtScoreRows.find((r) => r.courtId === courtId)
    if (!onSubmitScores || !gameRoundId || !row || !row.canSubmit || row.teamA === null || row.teamB === null) {
      return
    }
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
      setDrafts((prev) => ({
        ...prev,
        [courtId]: { teamA: String(row.teamA), teamB: String(row.teamB) },
      }))
      await Promise.resolve(onSaved?.())
      setDirtyCourts((prev) => {
        const next = new Set(prev)
        next.delete(courtId)
        return next
      })
    } catch (e) {
      setError({
        courtId,
        message: e instanceof Error ? e.message : t('common.submitFailed'),
      })
    } finally {
      setBusyCourtKey(null)
    }
  }

  return { courtScoreRows, setDraft, submitCourt, busyCourtKey, error, canEdit }
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
  onSaved?: () => void | Promise<void>
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
  const [dirtyCourts, setDirtyCourts] = useState<Set<string>>(() => new Set())
  const [busyCourtKey, setBusyCourtKey] = useState<string | null>(null)
  const [error, setError] = useState<{ courtKey: string; message: string } | null>(null)

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const { courtKey } of courts) {
        if (dirtyCourts.has(courtKey) && prev[courtKey]) continue
        const live = liveCourtScores?.get(courtKey)
        next[courtKey] = {
          teamA: live?.scoreA ?? '',
          teamB: live?.scoreB ?? '',
        }
      }
      return next
    })
  }, [courts, dirtyCourts, liveCourtScores, savedSnapshot])

  const setDraft = useCallback((courtKey: string, side: 'teamA' | 'teamB', value: string) => {
    setDirtyCourts((prev) => new Set(prev).add(courtKey))
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
      const isDirty = dirtyCourts.has(courtKey)
      const { teamAStr, teamBStr } = scoreStringsForCourt(draft, saved, isDirty)
      const teamA = parseScoreField(teamAStr)
      const teamB = parseScoreField(teamBStr)
      const canSubmit = courtSubmitReady(teamAStr, teamBStr, saved)
      return { courtKey, courtLabel, court, teamA, teamB, teamAStr, teamBStr, canSubmit }
    })
  }, [courts, dirtyCourts, drafts, liveCourtScores])

  const submitCourt = async (courtKey: string) => {
    const row = courtScoreRows.find((r) => r.courtKey === courtKey)
    if (!onSubmit || !row || !row.canSubmit || row.teamA === null || row.teamB === null) return
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
      setDrafts((prev) => ({
        ...prev,
        [courtKey]: { teamA: String(row.teamA), teamB: String(row.teamB) },
      }))
      await Promise.resolve(onSaved?.())
      setDirtyCourts((prev) => {
        const next = new Set(prev)
        next.delete(courtKey)
        return next
      })
    } catch (e) {
      setError({
        courtKey,
        message: e instanceof Error ? e.message : t('common.submitFailed'),
      })
    } finally {
      setBusyCourtKey(null)
    }
  }

  return { courtScoreRows, setDraft, submitCourt, busyCourtKey, error, canEdit }
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
  t: TranslateFn
}) {
  return (
    <div className="space-y-3">
      {courtScoreRows.map((row) => {
        const liveCourt = courtsForGame.find((c) => c.courtName === row.courtLabel)
        const courtId = row.courtId
        const court = row.court
        if (!court) return null
        const teamA = liveCourt?.teamA ?? court.teamA
        const teamB = liveCourt?.teamB ?? court.teamB
        const teamAPlayers = liveCourt?.teamAPlayers ?? court.teamAPlayers
        const teamBPlayers = liveCourt?.teamBPlayers ?? court.teamBPlayers
        const courtReady = row.canSubmit

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

        return (
          <CourtCard
            key={row.courtLabel}
            courtLabel={row.courtLabel}
            currentUserId={currentUserId}
            court={liveCourt ?? court}
            finished={finished}
            href={href}
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
                  onClick={(e) => {
                    e.stopPropagation()
                    void submitCourt(courtId)
                  }}
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
  currentUserId,
  court,
  finished,
  t,
}: {
  courtLabel: string
  currentUserId?: string | null
  court: LiveCourt | ScoringGame['courts'][number]
  finished: boolean
  t: TranslateFn
}) {
  const label = displayCourtLabel(courtLabel, t)
  const titleClass = courtLabelClass(currentUserId, court, finished)
  return (
    <div className="flex min-h-12 items-center justify-center px-3 py-2">
      <p className={`truncate text-center ${titleClass}`}>{label}</p>
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

function GameCardHeader({
  gameNumber,
  isLiveNow,
  isCurrentGame = false,
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
  isCurrentGame?: boolean
  timeLabel?: string
  countdown?: string | null
  countdownLabelText: string
  finished: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  t: TranslateFn
}) {
  const showLiveBadge = !finished && (isLiveNow || isCurrentGame)

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
          {showLiveBadge ? (
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
  displayTimeLabel,
  liveCourtEnabled,
  friendly,
  sessionId,
  competitionId,
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
  displayTimeLabel: string
  liveCourtEnabled: boolean
  friendly: boolean
  sessionId?: string
  competitionId?: string
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt: NonNullable<Props['matchForCourt']>
  scoreUnit: AmericanoScoringUnit
  playTo?: number
  canEdit: boolean
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void | Promise<void>
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
    <GameCardShell
      gameNumber={game.gameNumber}
      finished={finished}
      isCurrentGame={isCurrentGame}
      isMyGame={isMyGame}
    >
      <GameCardHeader
        gameNumber={game.gameNumber}
        isLiveNow={isLiveNow}
        isCurrentGame={isCurrentGame}
        timeLabel={displayTimeLabel}
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
            t={t}
          />
        </div>
      )}
    </GameCardShell>
  )
}

function FriendlyManualGameCard({
  game,
  scoreUnit,
  liveCourtScores,
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
  game: ScoringGame
  scoreUnit: AmericanoScoringUnit
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  onSubmitFriendlyScores?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void | Promise<void>
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
    <GameCardShell
      gameNumber={game.gameNumber}
      finished={finished}
      isCurrentGame={isCurrentGame}
    >
      <GameCardHeader
        gameNumber={game.gameNumber}
        isLiveNow={isLiveNow}
        isCurrentGame={isCurrentGame}
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
              {courtScoreRows.map((row) => {
                const teamA = row.court.teamA
                const teamB = row.court.teamB
                const courtReady = row.canSubmit
                return (
                  <CourtCard
                    key={row.courtLabel}
                    courtLabel={row.courtLabel}
                    currentUserId={currentUserId}
                    court={row.court}
                    finished={finished}
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
                          onClick={(e) => {
                            e.stopPropagation()
                            void submitCourt(row.courtKey)
                          }}
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
    </GameCardShell>
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
  liveCourtScores,
}: Props) {
  const { t } = useTranslation()
  const games = useMemo(() => {
    const rows = pivotScheduleByGame(columns)
    if (!roundTimesByGame?.size) return rows
    return rows.map((game) => {
      const times = roundTimesByGame.get(game.gameNumber)
      if (!times) return game
      const timeLabel = formatGameTimeLabel(times.startsAt, times.endsAt)
      return {
        ...game,
        timeLabel,
        courts: game.courts.map((court) => ({ ...court, timeLabel })),
      }
    })
  }, [columns, roundTimesByGame])
  const [tick, setTick] = useState(() => Date.now())
  const [collapsedGames, setCollapsedGames] = useState<Record<number, boolean>>({})
  const collapseSeedKeyRef = useRef<string | null>(null)
  const sessionId = friendlySessionId ?? competitionId
  const liveCourtEnabled = Boolean(
    sessionId && isAdmin && currentUserId && !(friendly && onSubmitFriendlyScores),
  )
  const friendlyManualScoring = Boolean(friendly && onSubmitFriendlyScores)
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

  const finishedByGame = useMemo(() => {
    const finishOpts = {
      mode,
      previewTimed,
      activeGameNumber,
      roundId,
      roundIdForGame,
      liveCourtsByGame,
      courtIdByLabel,
      matchForCourt,
      clock,
      roundTimesByGame,
      roundStatusByGame,
    }
    const map = new Map<number, boolean>()
    for (const game of orderedGames) {
      map.set(game.gameNumber, gameIsFinished(game, finishOpts))
    }
    return map
  }, [
    orderedGames,
    mode,
    previewTimed,
    activeGameNumber,
    roundId,
    roundIdForGame,
    liveCourtsByGame,
    courtIdByLabel,
    matchForCourt,
    clock,
    roundTimesByGame,
    roundStatusByGame,
  ])

  useLayoutEffect(() => {
    if (scoringTimeUnlocked || !sessionId || orderedGames.length === 0) return
    if (collapseSeedKeyRef.current === sessionId) return
    collapseSeedKeyRef.current = sessionId

    setCollapsedGames((prev) => {
      const next: Record<number, boolean> = { ...prev }
      for (const game of orderedGames) {
        if (finishedByGame.get(game.gameNumber)) next[game.gameNumber] = true
      }
      return next
    })
  }, [sessionId, orderedGames, finishedByGame, scoringTimeUnlocked])

  const toggleCollapsed = (gameNumber: number) => {
    setCollapsedGames((prev) => ({
      ...prev,
      [gameNumber]: !(prev[gameNumber] ?? false),
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
        const submitted = finishedByGame.get(game.gameNumber) ?? false
        const finished = submitted
        const countdown =
          timedMode && !submitted && times
            ? gameCountdown(clock, times, gameMinutes)
            : null
        const state = countdownState(clock, times, timeUp)
        const collapsed = collapsedGames[game.gameNumber] ?? false
        const isCurrentGame = !submitted && (isLiveNow || isActive)
        const canEditGame =
          Boolean(canLog) &&
          (scoringTimeUnlocked ||
            roundStatus === 'active' ||
            roundStatus === 'complete' ||
            isLiveNow ||
            timeUp)

        const displayTimeLabel =
          times != null
            ? formatGameTimeLabel(times.startsAt, times.endsAt)
            : game.timeLabel

        if (mode === 'scoring' && matchForCourt) {
          return (
            <ScoringGameCard
              key={game.gameNumber}
              game={game}
              displayTimeLabel={displayTimeLabel}
              liveCourtEnabled={liveCourtEnabled}
              friendly={friendly}
              sessionId={sessionId}
              competitionId={competitionId}
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
              onToggleCollapsed={() => toggleCollapsed(game.gameNumber)}
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
              game={game}
              scoreUnit={scoreUnit}
              liveCourtScores={liveCourtScores}
              onSubmitFriendlyScores={onSubmitFriendlyScores}
              onSaved={onSaved}
              isLiveNow={isLiveNow}
              isCurrentGame={isCurrentGame}
              countdown={countdown}
              countdownLabelText={countdownLabel(state, t)}
              finished={finished}
              collapsed={collapsed}
              onToggleCollapsed={() => toggleCollapsed(game.gameNumber)}
              currentUserId={currentUserId}
              currentUserAvatarUrl={currentUserAvatarUrl}
              t={t}
            />
          )
        }

        return (
          <GameCardShell
            key={game.gameNumber}
            gameNumber={game.gameNumber}
            finished={finished}
            isCurrentGame={isCurrentGame}
          >
            <GameCardHeader
              gameNumber={game.gameNumber}
              isLiveNow={isLiveNow}
              isCurrentGame={isCurrentGame}
              timeLabel={displayTimeLabel}
              countdown={countdown}
              countdownLabelText={countdownLabel(state, t)}
              finished={finished}
              collapsed={collapsed}
              onToggleCollapsed={() => toggleCollapsed(game.gameNumber)}
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

                  return (
                    <CourtCard
                      key={court.courtLabel}
                      courtLabel={court.courtLabel}
                      currentUserId={currentUserId}
                      court={liveCourt ?? court}
                      finished={finished}
                      href={href}
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
          </GameCardShell>
        )
      })}
    </div>
  )
}
