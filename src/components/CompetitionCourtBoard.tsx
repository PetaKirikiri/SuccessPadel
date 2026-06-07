import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { pivotScheduleByGame, type CourtColumn } from '../lib/competitionCourtBoard'
import { playTwoMinuteAlarm, TWO_MINUTES_MS } from '../lib/gameCountdownAlarm'
import { RANKED_GAME_MINUTES } from '../lib/competitionLayout'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import { parseScoreField, scoreDigitsOnly } from '../lib/competitionScoreInput'
import type { MatchTeam } from '../lib/types'

type LiveCourt = {
  courtId: string
  courtName: string
  teamA: string[]
  teamB: string[]
  playerIds: string[]
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
}

type RoundStatus = 'pending' | 'active' | 'complete'

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
  if (now < times.startsAt) return formatCountdown(fullMs)
  return formatCountdown(times.endsAt - now)
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
}: {
  teamA: string[]
  teamB: string[]
  scoreUnit: AmericanoScoringUnit
  scoreA?: string
  scoreB?: string
  onScoreA?: (v: string) => void
  onScoreB?: (v: string) => void
  disabled?: boolean
}) {
  const fieldLabel = scoreUnit === 'sets' ? 'Sets' : scoreUnit === 'open' ? 'Score' : 'Pts'
  const editable = Boolean(onScoreA && onScoreB && !disabled)
  const nameClass = 'truncate text-base font-semibold leading-tight text-brand-text'

  const scoreInputClass =
    'w-9 rounded border border-brand-border bg-brand-bg px-0.5 py-1 text-center text-lg font-bold tabular-nums text-brand-primary disabled:bg-brand-bg/50 disabled:text-brand-muted'

  const scoreBlock = editable ? (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={scoreA ?? ''}
        placeholder="—"
        onChange={(e) => onScoreA?.(e.target.value.replace(/\D/g, ''))}
        className={scoreInputClass}
        aria-label={`Near side ${fieldLabel}`}
      />
      <span className="text-xs font-semibold text-brand-muted">–</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={scoreB ?? ''}
        placeholder="—"
        onChange={(e) => onScoreB?.(e.target.value.replace(/\D/g, ''))}
        className={scoreInputClass}
        aria-label={`Far side ${fieldLabel}`}
      />
    </div>
  ) : (
    <div className="flex items-baseline gap-1 tabular-nums">
      <span className="text-xl font-bold text-brand-primary">{scoreA || '—'}</span>
      <span className="text-sm font-semibold text-brand-muted">–</span>
      <span className="text-xl font-bold text-brand-primary">{scoreB || '—'}</span>
    </div>
  )

  return (
    <div className="grid min-h-[4rem] grid-cols-[1fr_auto_1fr] items-stretch gap-2">
      <div
        className="flex min-w-0 flex-col justify-center rounded-lg border-2 border-brand-accent/45 bg-brand-accent/10 px-2 py-1.5"
        aria-label={`Team: ${teamA[0]} and ${teamA[1]}`}
      >
        <p className={nameClass}>{teamA[0]}</p>
        <p className="text-center text-[10px] font-bold leading-none text-brand-accent">&</p>
        <p className={nameClass}>{teamA[1]}</p>
      </div>

      <div className="flex min-w-[2.75rem] flex-col items-center justify-center gap-1 px-0.5">
        <span className="font-display text-[10px] font-bold uppercase tracking-wide text-brand-muted">
          vs
        </span>
        {scoreBlock}
      </div>

      <div
        className="flex min-w-0 flex-col justify-center rounded-lg border-2 border-brand-sage/45 bg-brand-sage/10 px-2 py-1.5 text-right"
        aria-label={`Team: ${teamB[0]} and ${teamB[1]}`}
      >
        <p className={nameClass}>{teamB[0]}</p>
        <p className="text-center text-[10px] font-bold leading-none text-brand-sage">&</p>
        <p className={nameClass}>{teamB[1]}</p>
      </div>
    </div>
  )
}

type CourtDraft = { teamA: string; teamB: string }

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

function GameScoringSection({
  game,
  gameRoundId,
  courtsForGame,
  courtIdByLabel,
  matchForCourt,
  scoreUnit,
  scoringOpen,
  canEdit,
  isHighlighted,
  onSubmitScores,
  onSaved,
}: {
  game: ReturnType<typeof pivotScheduleByGame>[number]
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt: NonNullable<Props['matchForCourt']>
  scoreUnit: AmericanoScoringUnit
  scoringOpen: boolean
  canEdit: boolean
  isHighlighted: boolean
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void
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
      setError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {game.courts.map((court) => {
        const liveCourt = courtsForGame.find((c) => c.courtName === court.courtLabel)
        const courtId = courtIdForLabel(court.courtLabel, courtsForGame, courtIdByLabel)
        const teamA = liveCourt?.teamA ?? court.teamA
        const teamB = liveCourt?.teamB ?? court.teamB
        const saved = gameRoundId && courtId ? matchForCourt(gameRoundId, courtId) : undefined
        const draft = courtId ? drafts[courtId] : undefined

        return (
          <div key={court.courtLabel} className="space-y-0.5">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
              {court.courtLabel}
            </p>
            <div
              className={`rounded-lg border px-1.5 py-1 ${
                isHighlighted
                  ? 'border-brand-accent/50 bg-brand-accent/5'
                  : 'border-brand-border/60 bg-brand-surface/40'
              }`}
            >
              <CourtMatchCell
                teamA={teamA}
                teamB={teamB}
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
              />
            </div>
          </div>
        )
      })}

      {scoringOpen && onSubmitScores && (
        <div className="space-y-1.5 border-t border-brand-border/50 pt-2">
          <button
            type="button"
            disabled={busy || !gameRoundId || !canEdit || pendingEntries.length === 0}
            onClick={() => void submitGame()}
            className="brand-btn w-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Submit scores'}
          </button>
          {!gameRoundId && (
            <p className="text-center text-xs text-brand-muted">Scores open when this game starts.</p>
          )}
          {gameRoundId && pendingEntries.length === 0 && !busy && (
            <p className="text-center text-xs text-brand-muted">
              Enter both scores for each court, then submit.
            </p>
          )}
          {error && <p className="text-center text-xs text-red-600">{error}</p>}
        </div>
      )}
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
}: Props) {
  const games = useMemo(() => pivotScheduleByGame(columns), [columns])
  const [tick, setTick] = useState(() => Date.now())

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

  return (
    <div className="space-y-4">
      {games.map((game) => {
        const isActive = activeGameNumber === game.gameNumber
        const times = roundTimesByGame?.get(game.gameNumber)
        const isLiveNow = mode === 'scoring' && isGameLive(clock, times)
        const finished = isGameFinished(
          game.gameNumber,
          clock,
          roundTimesByGame,
          roundStatusByGame,
        )
        const isHighlighted = !finished && (isLiveNow || (isActive && mode === 'scoring'))

        return (
          <div
            key={game.gameNumber}
            className={`game-card overflow-hidden p-0 ${
              finished ? 'shadow-sm' : 'shadow-md'
            } ${
              isHighlighted
                ? 'border-brand-accent bg-brand-bg-alt ring-2 ring-brand-accent/35'
                : 'border-brand-border bg-brand-surface'
            }`}
          >
            <div className={isHighlighted ? 'bg-brand-accent/15' : finished ? '' : 'bg-brand-bg-alt'}>
              <div className="px-3 py-2">
                <p
                  className={`font-display font-bold leading-none tracking-tight text-brand-primary ${
                    finished ? 'text-base' : 'text-lg'
                  }`}
                >
                  Game {game.gameNumber}
                </p>
                {finished && game.timeLabel && (
                  <p className="mt-0.5 text-[11px] tabular-nums text-brand-muted">{game.timeLabel}</p>
                )}
              </div>
              {mode === 'scoring' && !finished && (
                <div
                  className={`px-3 pb-2 pt-0 ${isLiveNow ? 'bg-brand-accent/10' : ''}`}
                  aria-live="polite"
                >
                  <p
                    className={`text-center font-display text-5xl font-bold leading-none tabular-nums tracking-tight ${
                      isLiveNow ? 'text-brand-accent' : 'text-brand-primary/60'
                    }`}
                  >
                    {gameCountdown(clock, times, gameMinutes)}
                  </p>
                </div>
              )}
              {mode === 'preview' && game.timeLabel && (
                <p className="px-4 pb-3 text-center text-xs font-semibold tabular-nums text-brand-muted">
                  {game.timeLabel}
                </p>
              )}
            </div>

            <div className="border-t border-brand-border/50 bg-brand-surface px-2 pb-2 pt-2">
                {mode === 'scoring' && matchForCourt ? (
                  <GameScoringSection
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
                    isHighlighted={isHighlighted}
                    onSubmitScores={onSubmitScores}
                    onSaved={onSaved}
                  />
                ) : (
                  <div className="space-y-2">
                    {game.courts.map((court) => {
                      const gameRoundId =
                        roundIdForGame?.(game.gameNumber) ?? (isActive ? roundId : undefined)
                      const courtsForGame = liveCourtsByGame?.get(game.gameNumber) ?? []
                      const liveCourt = courtsForGame.find((c) => c.courtName === court.courtLabel)
                      const courtId = courtIdForLabel(
                        court.courtLabel,
                        courtsForGame,
                        courtIdByLabel,
                      )
                      const saved =
                        gameRoundId && courtId && matchForCourt
                          ? matchForCourt(gameRoundId, courtId)
                          : undefined
                      return (
                        <div key={court.courtLabel} className="space-y-0.5">
                          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                            {court.courtLabel}
                          </p>
                          <div className="rounded-lg border border-brand-border/60 bg-brand-surface/40 px-1.5 py-1">
                            <CourtMatchCell
                              teamA={liveCourt?.teamA ?? court.teamA}
                              teamB={liveCourt?.teamB ?? court.teamB}
                              scoreUnit={scoreUnit}
                              scoreA={
                                saved?.teamAPoints != null ? String(saved.teamAPoints) : undefined
                              }
                              scoreB={
                                saved?.teamBPoints != null ? String(saved.teamBPoints) : undefined
                              }
                              disabled
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
