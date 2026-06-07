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
  const nameClass = 'truncate text-lg font-semibold leading-tight text-brand-text'

  const scoreInputClass =
    'w-9 rounded border border-brand-border bg-brand-surface px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-brand-text disabled:text-brand-muted'

  const scoreAEl = editable ? (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={scoreA ?? ''}
      placeholder="—"
      onChange={(e) => onScoreA?.(e.target.value.replace(/\D/g, ''))}
      className={scoreInputClass}
      aria-label={`Team A ${fieldLabel}`}
    />
  ) : (
    <span className="text-sm font-semibold tabular-nums text-brand-text">{scoreA || '—'}</span>
  )

  const scoreBEl = editable ? (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={scoreB ?? ''}
      placeholder="—"
      onChange={(e) => onScoreB?.(e.target.value.replace(/\D/g, ''))}
      className={scoreInputClass}
      aria-label={`Team B ${fieldLabel}`}
    />
  ) : (
    <span className="text-sm font-semibold tabular-nums text-brand-text">{scoreB || '—'}</span>
  )

  return (
    <div
      className="flex min-h-[4.5rem] items-stretch overflow-hidden rounded-lg border border-brand-border/60 bg-brand-surface"
      aria-label={`${teamA[0]} and ${teamA[1]} against ${teamB[0]} and ${teamB[1]}`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 border-r border-brand-border/60 px-2.5 py-2">
        <p className={nameClass}>{teamA[0]}</p>
        <p className={nameClass}>{teamA[1]}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1 px-2 tabular-nums">
        {scoreAEl}
        <span className="text-xs text-brand-muted">–</span>
        {scoreBEl}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 border-l border-brand-border/60 px-2.5 py-2 text-right">
        <p className={nameClass}>{teamB[0]}</p>
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
            <div className="rounded-lg border border-brand-border/60 bg-brand-surface px-1 py-1">
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
        const countdown =
          mode === 'scoring' && !finished
            ? gameCountdown(clock, times, gameMinutes)
            : null

        return (
          <div key={game.gameNumber} className="game-card overflow-hidden p-0">
            <div className="flex items-baseline justify-between gap-2 border-b border-brand-border/60 px-3 py-2">
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-brand-primary">
                  Game {game.gameNumber}
                  {isLiveNow ? (
                    <span className="ml-1.5 text-[10px] font-medium text-brand-muted">· Live</span>
                  ) : null}
                </p>
                {game.timeLabel && (
                  <p className="text-[10px] tabular-nums text-brand-muted">{game.timeLabel}</p>
                )}
              </div>
              {countdown && (
                <p
                  className="shrink-0 font-display text-base font-semibold tabular-nums text-brand-text"
                  aria-live="polite"
                >
                  {countdown}
                </p>
              )}
            </div>

            <div className="px-2 pb-2 pt-2">
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
                          <div className="rounded-lg border border-brand-border/60 bg-brand-surface px-1 py-1">
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
