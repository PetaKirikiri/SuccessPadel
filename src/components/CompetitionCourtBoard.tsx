import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import type { TranslateFn } from '../i18n'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { pivotScheduleByGame, type CourtColumn } from '../lib/competitionCourtBoard'
import { playTwoMinuteAlarm, TWO_MINUTES_MS } from '../lib/gameCountdownAlarm'
import { RANKED_GAME_MINUTES } from '../lib/competitionLayout'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import { parseScoreField, scoreDigitsOnly } from '../lib/competitionScoreInput'
import { compactDisplayNames } from '../lib/leaderboardEntries'
import type { CourtPlayer } from '../lib/americanoSchedule'
import type { MatchTeam } from '../lib/types'

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
  onSaved?: () => void
  now?: number
  gameMinutes?: number
  roundTimesByGame?: Map<number, { startsAt: number; endsAt: number }>
  roundStatusByGame?: Map<number, 'pending' | 'active' | 'complete'>
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
}

type RoundStatus = 'pending' | 'active' | 'complete'
type CountdownState = 'starts' | 'playing' | 'finished' | 'scheduled'

function isGameFinished(
  gameNumber: number,
  clock: number,
  roundTimesByGame?: Map<number, { startsAt: number; endsAt: number }>,
  roundStatusByGame?: Map<number, RoundStatus>,
): boolean {
  if (roundStatusByGame?.get(gameNumber) === 'complete') return true
  const times = roundTimesByGame?.get(gameNumber)
  return Boolean(times && clock >= times.endsAt)
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

function CourtMatchCell({
  teamA,
  teamB,
  scoreUnit,
  scoreA,
  scoreB,
  onScoreA,
  onScoreB,
  disabled = false,
  teamAPlayers,
  teamBPlayers,
  currentUserId,
  currentUserAvatarUrl,
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
  teamAPlayers?: CourtPlayer[]
  teamBPlayers?: CourtPlayer[]
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
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
    `flex min-w-0 items-center gap-1 rounded py-0.5 ${
      isCurrent ? 'animate-pulse bg-brand-bg-alt px-1 text-brand-accent' : 'px-0 text-brand-text'
    }`

  const scoreInputClass =
    'h-8 w-8 rounded-lg border border-brand-border/80 bg-brand-surface px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-brand-primary disabled:text-brand-muted/60 md:h-10 md:w-10 md:text-base'

  const scoreAEl = editable ? (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={scoreA ?? ''}
      placeholder="0"
      onChange={(e) => onScoreA?.(e.target.value.replace(/\D/g, ''))}
      className={scoreInputClass}
      aria-label={t('aria.teamAScore', { unit: fieldLabel })}
    />
  ) : (
    <span className="text-xs font-medium tabular-nums text-brand-muted">{scoreA || '—'}</span>
  )

  const scoreBEl = editable ? (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={scoreB ?? ''}
      placeholder="0"
      onChange={(e) => onScoreB?.(e.target.value.replace(/\D/g, ''))}
      className={scoreInputClass}
      aria-label={t('aria.teamBScore', { unit: fieldLabel })}
    />
  ) : (
    <span className="text-xs font-medium tabular-nums text-brand-muted">{scoreB || '—'}</span>
  )

  const playerEl = (player: CourtPlayer) => {
    const isCurrent = Boolean(currentUserId && player.id === currentUserId)
    const displayAvatarUrl = player.avatarUrl ?? (isCurrent ? currentUserAvatarUrl : null)
    const [displayName] = compactDisplayNames([player.name])
    return (
      <p className={playerClass(isCurrent)}>
        {displayAvatarUrl ? (
          <img
            src={displayAvatarUrl}
            alt=""
            className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-brand-border/60 md:h-7 md:w-7"
          />
        ) : (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-[9px] font-semibold text-brand-muted ring-1 ring-brand-border/40 md:h-7 md:w-7 md:text-[11px]">
            {displayName.trim()[0]?.toUpperCase() ?? '?'}
          </span>
        )}
        <span className="truncate text-base font-semibold leading-tight md:text-lg">
          {displayName}
        </span>
      </p>
    )
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-brand-border/60 bg-brand-surface"
      aria-label={`${teamA[0]} and ${teamA[1]} against ${teamB[0]} and ${teamB[1]}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_2rem_1px_minmax(0,1fr)_2rem] items-stretch gap-1.5 px-1 py-2">
        <div className="min-w-0 space-y-1">
          {playerEl(teamAPlayerList[0]!)}
          {playerEl(teamAPlayerList[1]!)}
        </div>
        <div className="flex items-center justify-center tabular-nums">
          {scoreAEl}
        </div>
        <span className="h-full w-px bg-brand-border/60" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          {playerEl(teamBPlayerList[0]!)}
          {playerEl(teamBPlayerList[1]!)}
        </div>
        <div className="flex items-center justify-center tabular-nums">
          {scoreBEl}
        </div>
      </div>
    </div>
  )
}

type CourtDraft = { teamA: string; teamB: string }

const COURT_LABEL_CLASS = 'text-sm font-semibold text-brand-primary md:text-base'

function courtIdForLabel(
  courtLabel: string,
  courtsForGame: LiveCourt[],
  courtIdByLabel?: Map<string, string>,
): string | undefined {
  return (
    courtsForGame.find((c) => c.courtName === courtLabel)?.courtId ??
    courtIdByLabel?.get(courtLabel)
  )
}

type ScoringGame = ReturnType<typeof pivotScheduleByGame>[number]

function useGameScoring({
  game,
  gameRoundId,
  courtsForGame,
  courtIdByLabel,
  matchForCourt,
  scoringOpen,
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
  scoringOpen: boolean
  canEdit: boolean
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void
  t: TranslateFn
}) {
  const [drafts, setDrafts] = useState<Record<string, CourtDraft>>({})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedSnapshot = useMemo(() => {
    if (!gameRoundId) return ''
    return game.courts
      .map((court) => {
        const courtId = courtIdForLabel(court.courtLabel, courtsForGame, courtIdByLabel)
        if (!courtId) return ''
        const saved = matchForCourt(gameRoundId, courtId)
        return `${courtId}:${saved?.teamAPoints ?? ''}:${saved?.teamBPoints ?? ''}:${saved?.playedAt ?? ''}`
      })
      .join('|')
  }, [courtIdByLabel, courtsForGame, game.courts, gameRoundId, matchForCourt])

  useEffect(() => {
    if (dirty || !gameRoundId) return
    const next: Record<string, CourtDraft> = {}
    for (const court of game.courts) {
      const courtId = courtIdForLabel(court.courtLabel, courtsForGame, courtIdByLabel)
      if (!courtId) continue
      const saved = matchForCourt(gameRoundId, courtId)
      next[courtId] = {
        teamA: saved?.teamAPoints != null ? String(saved.teamAPoints) : '',
        teamB: saved?.teamBPoints != null ? String(saved.teamBPoints) : '',
      }
    }
    setDrafts(next)
  }, [courtIdByLabel, courtsForGame, dirty, game.courts, gameRoundId, matchForCourt, savedSnapshot])

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

  const pendingEntries = useMemo(() => {
    if (!gameRoundId || !canEdit) return []
    const entries: CourtScoreSubmit[] = []
    for (const court of game.courts) {
      const courtId = courtIdForLabel(court.courtLabel, courtsForGame, courtIdByLabel)
      if (!courtId) continue
      const draft = drafts[courtId]
      if (!draft) continue
      const teamA = parseScoreField(draft.teamA)
      const teamB = parseScoreField(draft.teamB)
      if (teamA === null || teamB === null) continue
      const saved = matchForCourt(gameRoundId, courtId)
      if (saved?.teamAPoints === teamA && saved?.teamBPoints === teamB) continue
      entries.push({
        roundId: gameRoundId,
        courtId,
        teamA,
        teamB,
      })
    }
    return entries
  }, [canEdit, courtIdByLabel, courtsForGame, drafts, game.courts, gameRoundId, matchForCourt])

  const submitGame = async () => {
    if (!onSubmitScores || pendingEntries.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await onSubmitScores(pendingEntries)
      setDirty(false)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.submitFailed'))
    } finally {
      setBusy(false)
    }
  }

  const submitButton =
    scoringOpen && onSubmitScores ? (
      <button
        type="button"
        disabled={busy || !gameRoundId || !canEdit || pendingEntries.length === 0}
        onClick={() => void submitGame()}
        className="shrink-0 rounded border border-brand-border/70 px-1.5 py-0.5 text-[10px] font-normal text-brand-muted/80 disabled:opacity-25"
      >
        {busy ? '…' : t('common.submit')}
      </button>
    ) : null

  return { drafts, setDraft, submitButton, error, canEdit }
}

function GameScoringCourts({
  game,
  gameRoundId,
  courtsForGame,
  courtIdByLabel,
  matchForCourt,
  scoreUnit,
  drafts,
  setDraft,
  canEdit,
  currentUserId,
  currentUserAvatarUrl,
  highlightCurrentCourt,
  t,
}: {
  game: ScoringGame
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt: NonNullable<Props['matchForCourt']>
  scoreUnit: AmericanoScoringUnit
  drafts: Record<string, CourtDraft>
  setDraft: (courtId: string, side: 'teamA' | 'teamB', value: string) => void
  canEdit: boolean
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  highlightCurrentCourt?: boolean
  t: TranslateFn
}) {
  return (
    <div className="space-y-2">
      {game.courts.map((court) => {
        const liveCourt = courtsForGame.find((c) => c.courtName === court.courtLabel)
        const courtId = courtIdForLabel(court.courtLabel, courtsForGame, courtIdByLabel)
        const teamA = liveCourt?.teamA ?? court.teamA
        const teamB = liveCourt?.teamB ?? court.teamB
        const teamAPlayers = liveCourt?.teamAPlayers ?? court.teamAPlayers
        const teamBPlayers = liveCourt?.teamBPlayers ?? court.teamBPlayers
        const saved = gameRoundId && courtId ? matchForCourt(gameRoundId, courtId) : undefined
        const draft = courtId ? drafts[courtId] : undefined

        return (
          <div key={court.courtLabel} className="space-y-1">
            <p
              className={`${COURT_LABEL_CLASS} ${
                highlightCurrentCourt && courtHasCurrentUser(currentUserId, liveCourt ?? court)
                  ? 'animate-pulse rounded bg-brand-bg-alt px-1 text-brand-accent'
                  : ''
              }`}
            >
              {court.courtLabel}
            </p>
            <div>
              <CourtMatchCell
                teamA={teamA}
                teamB={teamB}
                teamAPlayers={teamAPlayers}
                teamBPlayers={teamBPlayers}
                scoreUnit={scoreUnit}
                scoreA={
                  canEdit
                    ? draft?.teamA ||
                      (saved?.teamAPoints != null ? String(saved.teamAPoints) : '')
                    : saved?.teamAPoints != null
                      ? String(saved.teamAPoints)
                      : ''
                }
                scoreB={
                  canEdit
                    ? draft?.teamB ||
                      (saved?.teamBPoints != null ? String(saved.teamBPoints) : '')
                    : saved?.teamBPoints != null
                      ? String(saved.teamBPoints)
                      : ''
                }
                onScoreA={
                  canEdit && courtId ? (v) => setDraft(courtId, 'teamA', v) : undefined
                }
                onScoreB={
                  canEdit && courtId ? (v) => setDraft(courtId, 'teamB', v) : undefined
                }
                disabled={!canEdit}
                currentUserId={currentUserId}
                currentUserAvatarUrl={currentUserAvatarUrl}
                t={t}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
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
  submit,
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
  submit?: ReactNode
  t: TranslateFn
}) {
  return (
    <div className="flex items-center gap-2 border-b border-brand-border/60 px-3 py-3 md:gap-3 md:px-4 md:py-4">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        aria-expanded={!collapsed}
      >
        <span className="shrink-0 text-sm text-brand-muted">{collapsed ? '▸' : '▾'}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-2xl font-bold leading-none text-brand-primary md:text-3xl">
            {t('competition.game', { number: gameNumber })}
            {isLiveNow ? (
              <span className="ml-1.5 text-sm font-medium text-brand-accent md:text-base">
                · {t('competition.live')}
              </span>
            ) : finished ? (
              <span className="ml-1.5 text-sm font-medium text-brand-muted md:text-base">
                · {t('competition.done')}
              </span>
            ) : null}
          </span>
          {timeLabel && (
            <span className="mt-1 block text-[11px] tabular-nums text-brand-muted md:text-sm">
              {timeLabel}
            </span>
          )}
        </span>
      </button>
      {countdown && (
        <div className="shrink-0 text-right" aria-live="polite">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted md:text-xs">
            {countdownLabelText}
          </p>
          <p className="font-display text-3xl font-bold leading-none tabular-nums text-brand-text md:text-4xl">
            {countdown}
          </p>
        </div>
      )}
      {submit}
    </div>
  )
}

function ScoringGameCard({
  game,
  gameRoundId,
  courtsForGame,
  courtIdByLabel,
  matchForCourt,
  scoreUnit,
  scoringOpen,
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
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt: NonNullable<Props['matchForCourt']>
  scoreUnit: AmericanoScoringUnit
  scoringOpen: boolean
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
  const { drafts, setDraft, submitButton, error, canEdit: editable } = useGameScoring({
    game,
    gameRoundId,
    courtsForGame,
    courtIdByLabel,
    matchForCourt,
    scoringOpen,
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
    <div
      className={`game-card overflow-hidden p-0 ${
        isCurrentGame ? 'border-2 border-brand-accent ring-2 ring-brand-accent/30' : ''
      } ${isMyGame ? 'ring-2 ring-brand-accent/70' : ''}`}
    >
      <GameCardHeader
        gameNumber={game.gameNumber}
        isLiveNow={isLiveNow}
        timeLabel={game.timeLabel}
        countdown={countdown}
        countdownLabelText={countdownLabelText}
        finished={finished}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        submit={submitButton}
        t={t}
      />
      {error && <p className="px-3 pb-1 text-right text-[10px] text-red-600">{error}</p>}
      {!collapsed && <div className="px-1 pb-2 pt-2">
        <GameScoringCourts
          game={game}
          gameRoundId={gameRoundId}
          courtsForGame={courtsForGame}
          courtIdByLabel={courtIdByLabel}
          matchForCourt={matchForCourt}
          scoreUnit={scoreUnit}
          drafts={drafts}
          setDraft={setDraft}
          canEdit={editable}
          currentUserId={currentUserId}
          currentUserAvatarUrl={currentUserAvatarUrl}
          highlightCurrentCourt={isCurrentGame}
          t={t}
        />
      </div>}
    </div>
  )
}

export function CompetitionCourtBoard({
  columns,
  mode,
  activeGameNumber,
  scoreUnit = 'sets',
  roundId,
  liveCourtsByGame,
  canLog,
  roundIdForGame,
  courtIdByLabel,
  matchForCourt,
  onSubmitScores,
  onSaved,
  now,
  gameMinutes = RANKED_GAME_MINUTES,
  roundTimesByGame,
  roundStatusByGame,
  currentUserId,
  currentUserAvatarUrl,
}: Props) {
  const { t } = useTranslation()
  const games = useMemo(() => pivotScheduleByGame(columns), [columns])
  const [tick, setTick] = useState(() => Date.now())
  const [collapsedGames, setCollapsedGames] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (mode !== 'scoring') return
    const t = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [mode])

  const clock = mode === 'scoring' ? tick : (now ?? tick)
  const prevRemainingMsRef = useRef(new Map<number, number>())
  const alarmedGamesRef = useRef(new Set<number>())

  useEffect(() => {
    if (mode !== 'scoring' || !roundTimesByGame) return
    for (const game of games) {
      const times = roundTimesByGame.get(game.gameNumber)
      if (!times || !isGameLive(clock, times)) continue
      if (isGameFinished(game.gameNumber, clock, roundTimesByGame, roundStatusByGame)) continue

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

  const orderedGames = useMemo(
    () =>
      [...games].sort((a, b) => {
        const aTimes = roundTimesByGame?.get(a.gameNumber)
        const bTimes = roundTimesByGame?.get(b.gameNumber)
        const aFinished = isGameFinished(a.gameNumber, clock, roundTimesByGame, roundStatusByGame)
        const bFinished = isGameFinished(b.gameNumber, clock, roundTimesByGame, roundStatusByGame)
        const aLive = isGameLive(clock, aTimes)
        const bLive = isGameLive(clock, bTimes)
        const aCurrent = !aFinished && (aLive || activeGameNumber === a.gameNumber)
        const bCurrent = !bFinished && (bLive || activeGameNumber === b.gameNumber)
        const rank = (isCurrent: boolean, isFinished: boolean, times?: { startsAt: number }) => {
          if (isCurrent) return 0
          if (isFinished) return 3
          if (times && clock < times.startsAt) return 1
          return 2
        }
        const aRank = rank(aCurrent, aFinished, aTimes)
        const bRank = rank(bCurrent, bFinished, bTimes)
        if (aRank !== bRank) return aRank - bRank
        return (aTimes?.startsAt ?? a.gameNumber) - (bTimes?.startsAt ?? b.gameNumber)
      }),
    [activeGameNumber, clock, games, roundStatusByGame, roundTimesByGame],
  )

  const toggleCollapsed = (gameNumber: number, defaultCollapsed: boolean) => {
    setCollapsedGames((prev) => ({
      ...prev,
      [gameNumber]: !(prev[gameNumber] ?? defaultCollapsed),
    }))
  }

  return (
    <div className="space-y-4">
      {orderedGames.map((game) => {
        const isActive = activeGameNumber === game.gameNumber
        const times = roundTimesByGame?.get(game.gameNumber)
        const isLiveNow = mode === 'scoring' && isGameLive(clock, times)
        const finished = isGameFinished(
          game.gameNumber,
          clock,
          roundTimesByGame,
          roundStatusByGame,
        )
        const countdown =
          mode === 'scoring' && !finished
            ? gameCountdown(clock, times, gameMinutes)
            : null
        const state = countdownState(clock, times, finished)
        const collapsed = collapsedGames[game.gameNumber] ?? finished
        const isCurrentGame = !finished && (isLiveNow || isActive)

        if (mode === 'scoring' && matchForCourt) {
          return (
            <ScoringGameCard
              key={game.gameNumber}
              game={game}
              gameRoundId={
                roundIdForGame?.(game.gameNumber) ?? (isActive ? roundId : undefined)
              }
              courtsForGame={liveCourtsByGame?.get(game.gameNumber) ?? []}
              courtIdByLabel={courtIdByLabel}
              matchForCourt={matchForCourt}
              scoreUnit={scoreUnit}
              scoringOpen={Boolean(canLog)}
              canEdit={Boolean(canLog)}
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

        return (
          <div
            key={game.gameNumber}
            className={`game-card overflow-hidden p-0 ${
              isCurrentGame ? 'border-2 border-brand-accent ring-2 ring-brand-accent/30' : ''
            }`}
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
            {!collapsed && <div className="px-1 pb-2 pt-2">
              <div className="space-y-2">
                {game.courts.map((court) => {
                  const gameRoundId =
                    roundIdForGame?.(game.gameNumber) ?? (isActive ? roundId : undefined)
                  const courtsForGame = liveCourtsByGame?.get(game.gameNumber) ?? []
                  const liveCourt = courtsForGame.find((c) => c.courtName === court.courtLabel)
                  const courtId = courtIdForLabel(court.courtLabel, courtsForGame, courtIdByLabel)
                  const saved =
                    gameRoundId && courtId && matchForCourt
                      ? matchForCourt(gameRoundId, courtId)
                      : undefined
                  return (
                    <div key={court.courtLabel} className="space-y-1">
                      <p
                        className={`${COURT_LABEL_CLASS} ${
                          isCurrentGame && courtHasCurrentUser(currentUserId, liveCourt ?? court)
                            ? 'animate-pulse rounded bg-brand-bg-alt px-1 text-brand-accent'
                            : ''
                        }`}
                      >
                        {court.courtLabel}
                      </p>
                      <div>
                        <CourtMatchCell
                          teamA={liveCourt?.teamA ?? court.teamA}
                          teamB={liveCourt?.teamB ?? court.teamB}
                          teamAPlayers={liveCourt?.teamAPlayers ?? court.teamAPlayers}
                          teamBPlayers={liveCourt?.teamBPlayers ?? court.teamBPlayers}
                          scoreUnit={scoreUnit}
                          scoreA={
                            saved?.teamAPoints != null ? String(saved.teamAPoints) : undefined
                          }
                          scoreB={
                            saved?.teamBPoints != null ? String(saved.teamBPoints) : undefined
                          }
                          disabled
                          currentUserId={currentUserId}
                          currentUserAvatarUrl={currentUserAvatarUrl}
                          t={t}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>}
          </div>
        )
      })}
    </div>
  )
}
