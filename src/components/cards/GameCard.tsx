import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { TranslateFn } from '../../i18n'
import type { AmericanoScoringUnit } from '../../lib/competitionPresets'
import { pivotScheduleByGame } from '../../lib/competitionCourtBoard'
import type { CourtScoreSubmit } from '../../lib/competitionScoreInput'
import {
  courtSubmitReady,
  effectiveScoreField,
  parseScoreField,
  scoreDigitsOnly,
  scoreFieldSubmitValue,
} from '../../lib/competitionScoreInput'
import { liveCourtScoreKey, type LiveCourtGamesScore, type LiveCourtPointFeed } from '../../lib/liveCourtScore'
import { LiveScoreFeed } from '../LiveScoreFeed'
import type { FriendlyCourtScoreSubmit } from '../../lib/friendlyManualScore'
import type { MatchTeam } from '../../lib/types'
import { TvPlayQrPanel } from '../competitionPlay/TvPlayQrPanel'
import type { TvGameNav } from '../competitionPlay/CompetitionTvGameCarousel'
import { CourtCard, CourtMatchCell, courtGestureScoreHref, courtLiveHref, courtManualScoreHref, CourtTvScorePanel } from './CourtCard'
import type { LiveCourt } from './gameBoardTypes'
import type { CourtPlayer } from '../../lib/americanoSchedule'

export type ScoringGame = ReturnType<typeof pivotScheduleByGame>[number]

type CourtDraft = { teamA: string; teamB: string }

type DuoTeamLabels = (
  teamA: [string, string],
  teamB: [string, string],
  teamAPlayers?: CourtPlayer[],
  teamBPlayers?: CourtPlayer[],
) => { teamALabel?: string; teamBLabel?: string }

type MatchForCourt = (
  roundId: string,
  courtId: string,
) => {
  score_summary?: string
  teamAPoints?: number
  teamBPoints?: number
  winner?: MatchTeam
  playedAt?: string
} | undefined

export function courtIdForLabel(
  courtLabel: string,
  courtIndex: number,
  courtsForGame: LiveCourt[],
  courtIdByLabel?: Map<string, string>,
): string | undefined {
  const live = courtsForGame.find(
    (c) => c.courtName === courtLabel || c.courtName.toLowerCase() === courtLabel.toLowerCase(),
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
  saved: { teamAPoints?: number; teamBPoints?: number } | undefined,
  dirty: boolean,
): { teamAStr: string; teamBStr: string } {
  if (dirty && draft != null) {
    return { teamAStr: draft.teamA ?? '', teamBStr: draft.teamB ?? '' }
  }
  return {
    teamAStr: effectiveScoreField(draft?.teamA, saved?.teamAPoints, false),
    teamBStr: effectiveScoreField(draft?.teamB, saved?.teamBPoints, false),
  }
}

function nextCourtDraft(
  current: CourtDraft | undefined,
  side: 'teamA' | 'teamB',
  value: string,
): CourtDraft {
  const next = {
    teamA: current?.teamA ?? '',
    teamB: current?.teamB ?? '',
    [side]: scoreDigitsOnly(value),
  }
  return next
}

function courtsGridClass(tvCompact: boolean, courtCount: number): string {
  if (!tvCompact) return 'space-y-3.5'
  if (courtCount <= 1) return 'tv-game-courts-grid tv-game-courts-grid--single'
  if (courtCount === 2) return 'tv-game-courts-grid tv-game-courts-grid--duo'
  return 'tv-game-courts-grid'
}

export function courtsGridProps(
  tvCompact: boolean,
  courtCount: number,
): { className: string; style?: CSSProperties } {
  if (!tvCompact) return { className: courtsGridClass(false, courtCount) }
  const rows = Math.max(1, Math.ceil(courtCount / 2))
  return {
    className: `${courtsGridClass(true, courtCount)} min-h-0 flex-1`,
    style: { gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` },
  }
}

export function tvCourtsBodyClass(tvCompact: boolean, finished: boolean): string {
  if (!tvCompact) {
    return `border-t px-3 pb-3.5 pt-3 md:px-4 ${
      finished ? 'border-brand-border/40 bg-brand-bg-alt/70' : 'border-brand-border/30 bg-brand-bg-alt'
    }`
  }
  return `tv-game-courts-body border-t flex min-h-0 flex-1 flex-col overflow-hidden px-0.5 pb-0 pt-1 ${
    finished ? 'border-brand-border/40 bg-brand-bg-alt/70' : 'border-brand-border/30 bg-brand-bg-alt'
  }`
}

function gameCardShellClass({
  finished,
  isMyGame = false,
}: {
  finished: boolean
  isMyGame?: boolean
}) {
  const parts = [
    'w-full min-w-0 overflow-hidden rounded-2xl border-2 bg-brand-surface shadow-[0_10px_30px_-12px_rgba(96,45,36,0.35)] transition-colors dark:border-white/15 dark:bg-white/[0.07] dark:shadow-none',
  ]
  if (finished) {
    parts.push(
      'border-brand-border/55 bg-[#f4f3f1] shadow-[0_4px_14px_-10px_rgba(96,45,36,0.2)] dark:border-white/12 dark:bg-white/[0.04] dark:shadow-none',
    )
  } else {
    parts.push('border-brand-primary/40 dark:border-brand-accent/35')
  }
  if (isMyGame && !finished) {
    parts.push('ring-2 ring-brand-accent/70 dark:ring-brand-accent/50')
  }
  return parts.join(' ')
}

export function GameCardShell({
  gameNumber,
  finished,
  isCurrentGame,
  isMyGame = false,
  tvCompact = false,
  children,
}: {
  gameNumber: number
  finished: boolean
  isCurrentGame: boolean
  isMyGame?: boolean
  tvCompact?: boolean
  children: ReactNode
}) {
  const shellClass = `${gameCardShellClass({ finished, isMyGame })}${
    tvCompact ? ' tv-game-card flex min-h-0 flex-1 flex-col' : ''
  }`
  const live = isCurrentGame && !finished

  if (live) {
    return (
      <div
        id={`game-${gameNumber}`}
        className={`game-card-racetrack rounded-2xl${tvCompact ? ' tv-game-card-racetrack flex min-h-0 flex-1 flex-col' : ''}`}
      >
        <div className={`${shellClass} !rounded-[14px]${tvCompact ? ' min-h-0 flex-1' : ''}`}>{children}</div>
      </div>
    )
  }

  return (
    <div id={`game-${gameNumber}`} className={shellClass}>
      {children}
    </div>
  )
}
export function useGameScoring({
  game,
  gameRoundId,
  courtsForGame,
  courtIdByLabel,
  matchForCourt,
  canEdit,
  onSubmitScores,
  onSaved,
  playTo,
  t,
}: {
  game: ScoringGame
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt: NonNullable<MatchForCourt>
  canEdit: boolean
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void | Promise<void>
  playTo?: number
  t: TranslateFn
}) {
  const [drafts, setDrafts] = useState<Record<string, CourtDraft>>({})
  const [dirtyCourts, setDirtyCourts] = useState<Set<string>>(() => new Set())
  const [busyCourtKey, setBusyCourtKey] = useState<string | null>(null)
  const [error, setError] = useState<{ courtId: string; message: string } | null>(null)

  useEffect(() => {
    setDirtyCourts(new Set())
    setError(null)
  }, [game.gameNumber, gameRoundId])

  const scoringCourts = useMemo(() => {
    const liveByName = new Map(courtsForGame.map((court) => [court.courtName, court]))
    return game.courts.flatMap((court, courtIndex) => {
      const live = liveByName.get(court.courtLabel)
      const courtId =
        live?.courtId ??
        courtIdForLabel(court.courtLabel, courtIndex, courtsForGame, courtIdByLabel)
      if (!courtId) return []
      return [{ courtId, courtLabel: court.courtLabel }]
    })
  }, [courtIdByLabel, courtsForGame, game.courts])

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
      [courtId]: nextCourtDraft(prev[courtId], side, value),
    }))
  }, [])

  const courtScoreRows = useMemo(() => {
    return scoringCourts.map(({ courtId, courtLabel }) => {
      const draft = drafts[courtId]
      const saved = gameRoundId ? matchForCourt(gameRoundId, courtId) : undefined
      const isDirty = dirtyCourts.has(courtId)
      const { teamAStr, teamBStr } = scoreStringsForCourt(draft, saved, isDirty)
      const teamA = parseScoreField(teamAStr)
      const teamB = parseScoreField(teamBStr)
      const court = game.courts.find((c) => c.courtLabel === courtLabel)
      const canSubmit = courtSubmitReady(teamAStr, teamBStr, playTo)
      return { courtId, courtLabel, court, teamA, teamB, teamAStr, teamBStr, saved, canSubmit, dirty: isDirty }
    })
  }, [dirtyCourts, drafts, game.courts, gameRoundId, matchForCourt, playTo, scoringCourts])

  const submitCourt = async (courtId: string) => {
    const row = courtScoreRows.find((r) => r.courtId === courtId)
    if (!onSubmitScores || !gameRoundId || !row || !row.canSubmit) {
      return
    }
    const teamA = scoreFieldSubmitValue(row.teamAStr)
    const teamB = scoreFieldSubmitValue(row.teamBStr)
    setBusyCourtKey(courtId)
    setError(null)
    try {
      await onSubmitScores([
        {
          roundId: gameRoundId,
          courtId,
          teamA,
          teamB,
        },
      ])
      setDrafts((prev) => ({
        ...prev,
        [courtId]: { teamA: String(teamA), teamB: String(teamB) },
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
  playTo,
  t,
}: {
  game: ScoringGame
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  canEdit: boolean
  onSubmit?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void | Promise<void>
  playTo?: number
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
      [courtKey]: nextCourtDraft(prev[courtKey], side, value),
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
      const canSubmit = courtSubmitReady(teamAStr, teamBStr, playTo)
      return { courtKey, courtLabel, court, teamA, teamB, teamAStr, teamBStr, canSubmit }
    })
  }, [courts, dirtyCourts, drafts, liveCourtScores, playTo])

  const submitCourt = async (courtKey: string) => {
    const row = courtScoreRows.find((r) => r.courtKey === courtKey)
    if (!onSubmit || !row || !row.canSubmit) return
    const teamA = scoreFieldSubmitValue(row.teamAStr)
    const teamB = scoreFieldSubmitValue(row.teamBStr)
    setBusyCourtKey(courtKey)
    setError(null)
    try {
      await onSubmit([
        {
          gameNumber: game.gameNumber,
          courtLabel: row.courtLabel,
          teamA,
          teamB,
          teamAPlayers: row.court.teamAPlayers,
          teamBPlayers: row.court.teamBPlayers,
        },
      ])
      setDrafts((prev) => ({
        ...prev,
        [courtKey]: { teamA: String(teamA), teamB: String(teamB) },
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
export function GameScoringCourts({
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
  currentUserDisplayName,
  currentUserAvatarUrl,
  liveCourtEnabled,
  gestureScoreEnabled = false,
  manualScoreEnabled = false,
  friendly,
  sessionId,
  competitionId,
  duoTeamLabels,
  courtScoreMax,
  gameRoundId,
  liveCourtScores,
  liveCourtFeeds,
  tvCompact = false,
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
  currentUserId?: string | null
  currentUserDisplayName?: string | null
  currentUserAvatarUrl?: string | null
  liveCourtEnabled: boolean
  gestureScoreEnabled?: boolean
  manualScoreEnabled?: boolean
  friendly: boolean
  sessionId?: string
  competitionId?: string
  duoTeamLabels?: DuoTeamLabels
  courtScoreMax?: number
  gameRoundId?: string
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  liveCourtFeeds?: Map<string, LiveCourtPointFeed>
  tvCompact?: boolean
  t: TranslateFn
}) {
  return (
    <div {...courtsGridProps(tvCompact, courtScoreRows.length)}>
      {courtScoreRows.map((row) => {
        const liveCourt = courtsForGame.find((c) => c.courtName === row.courtLabel)
        const courtId = row.courtId
        const court = row.court
        if (!court) return null
        const teamA = liveCourt?.teamA ?? court.teamA
        const teamB = liveCourt?.teamB ?? court.teamB
        const teamAPlayers = liveCourt?.teamAPlayers ?? court.teamAPlayers
        const teamBPlayers = liveCourt?.teamBPlayers ?? court.teamBPlayers
        const sideLabels = duoTeamLabels?.(
          [teamA[0] ?? '', teamA[1] ?? ''],
          [teamB[0] ?? '', teamB[1] ?? ''],
          teamAPlayers,
          teamBPlayers,
        )
        const courtReady = row.canSubmit
        const showTvFallbackScoring = Boolean(tvCompact && submitCourt && canEdit)

        const courtScoreKey = liveCourtScoreKey(game.gameNumber, row.courtLabel)
        const liveScore = liveCourtScores?.get(courtScoreKey)
        const feed = liveCourtFeeds?.get(courtScoreKey)
        const gestureHref = courtGestureScoreHref({
          gestureScoreEnabled,
          friendly,
          sessionId,
          competitionId,
          gameNumber: game.gameNumber,
          courtLabel: row.courtLabel,
          courtId,
          currentUserId,
          currentUserDisplayName,
          court: liveCourt ?? court,
          finished,
        })
        const manualHref = courtManualScoreHref({
          manualScoreEnabled,
          friendly,
          sessionId,
          gameNumber: game.gameNumber,
          courtLabel: row.courtLabel,
          finished,
          currentUserId,
        })

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
            currentUserDisplayName={currentUserDisplayName}
            court={liveCourt ?? court}
            finished={finished}
            href={href}
            gestureScoreHref={gestureHref}
            gestureScoreLive={feed?.live}
            manualScoreHref={manualHref}
            tvCompact={tvCompact}
            t={t}
          >
            {showTvFallbackScoring ? (
              <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
                <CourtMatchCell
                  teamA={teamA}
                  teamB={teamB}
                  teamAPlayers={teamAPlayers}
                  teamBPlayers={teamBPlayers}
                  teamALabel={sideLabels?.teamALabel}
                  teamBLabel={sideLabels?.teamBLabel}
                  scoreUnit={scoreUnit}
                  disabled
                  finished={finished}
                  currentUserId={currentUserId}
                  currentUserDisplayName={currentUserDisplayName}
                  currentUserAvatarUrl={currentUserAvatarUrl}
                  embedded
                  compact={tvCompact}
                  t={t}
                />
                <CourtTvScorePanel
                  teamAStr={row.teamAStr}
                  teamBStr={row.teamBStr}
                  onScoreA={(v) => setDraft(courtId, 'teamA', v)}
                  onScoreB={(v) => setDraft(courtId, 'teamB', v)}
                  onSubmit={() => void submitCourt?.(courtId)}
                  canEdit={canEdit}
                  canSubmit={canEdit && courtReady}
                  busy={busyCourtKey === courtId}
                  finished={finished}
                  scoreMax={courtScoreMax}
                  errorMessage={courtError?.courtId === courtId ? courtError.message : null}
                  t={t}
                />
              </div>
            ) : (
              <CourtMatchCell
                teamA={teamA}
                teamB={teamB}
                teamAPlayers={teamAPlayers}
                teamBPlayers={teamBPlayers}
                teamALabel={sideLabels?.teamALabel}
                teamBLabel={sideLabels?.teamBLabel}
                scoreUnit={scoreUnit}
                scoreA={liveScore?.scoreA ?? row.teamAStr}
                scoreB={liveScore?.scoreB ?? row.teamBStr}
                onScoreA={canEdit ? (v) => setDraft(courtId, 'teamA', v) : undefined}
                onScoreB={canEdit ? (v) => setDraft(courtId, 'teamB', v) : undefined}
                disabled={!canEdit}
                finished={finished}
                scoreMax={courtScoreMax}
                currentUserId={currentUserId}
                currentUserDisplayName={currentUserDisplayName}
                currentUserAvatarUrl={currentUserAvatarUrl}
                embedded
                compact={tvCompact}
                t={t}
              />
            )}
            <LiveScoreFeed points={feed?.points} compact={tvCompact} />
            {!tvCompact && canEdit && submitCourt && gameRoundId ? (
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
function GameCardBackButton({
  onClick,
  ariaLabel,
  finished = false,
}: {
  onClick: () => void
  ariaLabel: string
  finished?: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={ariaLabel}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-lg font-medium leading-none shadow-sm transition active:scale-95 ${
        finished
          ? 'border-brand-border/60 bg-brand-bg-alt text-brand-primary'
          : 'border-white/25 bg-white/10 text-brand-bg-alt dark:border-white/15 dark:text-brand-accent-light'
      }`}
    >
      ←
    </button>
  )
}
export function GameCardHeader({
  gameNumber,
  isLiveNow,
  isCurrentGame: _isCurrentGame = false,
  timeLabel,
  countdown,
  countdownLabelText,
  finished,
  collapsed,
  onToggleCollapsed,
  hideCollapse = false,
  tvCompact = false,
  tvNav,
  carouselHideLogo = false,
  onBack,
  viewAlongUrl,
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
  hideCollapse?: boolean
  tvCompact?: boolean
  tvNav?: TvGameNav
  carouselHideLogo?: boolean
  onBack?: () => void
  viewAlongUrl?: string | null
  t: TranslateFn
}) {
  const showLiveBadge = !finished && isLiveNow
  const headerPad = tvCompact ? 'px-3 py-2.5' : 'px-3 py-3.5 md:px-4 md:py-4'
  const gameTitleClass = tvCompact
    ? 'font-display text-4xl font-extrabold leading-none tabular-nums md:text-5xl'
    : 'font-display text-2xl font-bold leading-none tabular-nums md:text-3xl'
  const headerShellClass = `flex items-stretch border-b-2 ${
    finished
      ? 'border-brand-border/50 bg-[#e8e7e5] dark:border-white/12 dark:bg-white/[0.06]'
      : 'border-brand-accent/50 bg-brand-primary dark:border-brand-accent/40 dark:bg-white/[0.08]'
  }`
  const collapseBtnClass = `flex min-w-12 shrink-0 items-center justify-center self-stretch border-l px-4 text-2xl leading-none transition active:opacity-70 md:min-w-14 md:px-5 md:text-3xl ${
    finished
      ? 'border-brand-border/50 text-brand-sage/80 dark:text-brand-muted'
      : 'border-white/25 text-brand-bg-alt dark:border-white/15 dark:text-brand-muted'
  }`

  const countdownBlock = countdown ? (
    <div
      className={`shrink-0 text-right ${
        tvCompact ? 'px-3 py-1' : ''
      }`}
      aria-live="polite"
    >
      <p
        className={`font-semibold uppercase tracking-wide ${
          tvCompact ? 'text-sm' : 'text-[10px] md:text-xs'
        } ${
          finished ? 'text-brand-muted' : 'text-white/80 dark:text-brand-muted'
        }`}
      >
        {countdownLabelText}
      </p>
      <p
        className={`font-display font-bold leading-none tabular-nums ${
          tvCompact ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'
        } ${finished ? 'text-[#602d24]' : 'text-[#7dd3fc]'}`}
      >
        {countdown}
      </p>
    </div>
  ) : null

  if (tvNav) {
    return (
      <div className={headerShellClass}>
        <div className={`relative grid min-h-[4.5rem] min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 ${headerPad}`}>
          <div className="flex items-center justify-start">
            {onBack ? (
              <GameCardBackButton onClick={onBack} ariaLabel={t('aria.back')} finished={finished} />
            ) : (
              <span className="w-8 shrink-0" aria-hidden />
            )}
          </div>
          <div className="pointer-events-none relative col-start-2 flex min-w-0 items-center justify-center justify-self-center">
            {!carouselHideLogo ? (
              <img
                src="/brand/logo-padel.webp"
                alt=""
                aria-hidden="true"
                className="absolute right-full mr-6 h-20 w-auto max-w-[15rem] shrink-0 object-contain"
              />
            ) : null}
            <p
              className={`shrink-0 ${gameTitleClass} ${
                finished ? 'text-[#602d24]/80' : 'text-[#7dd3fc]'
              }`}
            >
              {t('competition.game', { number: gameNumber })}
            </p>
            <div className="absolute left-full ml-4 flex items-center gap-2">
              {showLiveBadge ? (
                <span
                  className={`shrink-0 text-xs font-semibold md:text-sm ${
                    finished ? 'text-[#602d24]/70' : 'text-[#7dd3fc]/80'
                  }`}
                >
                  {t('competition.live')}
                </span>
              ) : finished ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#602d24]/65 md:text-sm">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#602d24]/45" aria-hidden />
                  {t('competition.done')}
                </span>
              ) : null}
              {timeLabel ? (
                <span
                  className={`shrink-0 text-[11px] tabular-nums md:text-sm ${
                    finished ? 'text-[#602d24]/65' : 'text-[#7dd3fc]/70'
                  }`}
                >
                  {timeLabel}
                </span>
              ) : null}
            </div>
          </div>
          <div className="col-start-3 flex min-w-0 items-center justify-end gap-2 justify-self-end">
            {countdownBlock}
            {viewAlongUrl ? <TvPlayQrPanel url={viewAlongUrl} header /> : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={headerShellClass}>
      <div className={`flex min-w-0 flex-1 items-center gap-2 md:gap-3 ${headerPad}`}>
        {onBack ? (
          <GameCardBackButton onClick={onBack} ariaLabel={t('aria.back')} finished={finished} />
        ) : null}
        <p
          className={`shrink-0 ${gameTitleClass} ${
            finished ? 'text-brand-sage dark:text-brand-muted' : 'text-brand-accent-light dark:text-brand-fun'
          }`}
        >
          {t('competition.game', { number: gameNumber })}
        </p>
        <div className="min-w-0 flex-1">
          {showLiveBadge ? (
            <span
              className={`text-xs font-semibold md:text-sm ${
                finished ? 'text-brand-accent' : 'text-brand-bg-alt dark:text-brand-fun'
              }`}
            >
              {t('competition.live')}
            </span>
          ) : finished ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-muted md:text-sm">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-sage/60 dark:bg-brand-muted/60" aria-hidden />
              {t('competition.done')}
            </span>
          ) : null}
          {timeLabel ? (
            <span
              className={`mt-0.5 block text-[11px] tabular-nums md:text-sm ${
                finished ? 'text-brand-muted' : 'text-white/75 dark:text-brand-muted'
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
                finished ? 'text-brand-muted' : 'text-white/65 dark:text-brand-muted'
              }`}
            >
              {countdownLabelText}
            </p>
            <p
              className={`font-display text-2xl font-bold leading-none tabular-nums md:text-3xl ${
                finished ? 'text-brand-primary dark:text-brand-text' : 'text-brand-bg-alt dark:text-brand-text'
              }`}
            >
              {countdown}
            </p>
          </div>
        ) : null}
      </div>
      {!hideCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className={collapseBtnClass}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      ) : null}
    </div>
  )
}

export function ScoringGameCard({
  game,
  displayTimeLabel,
  liveCourtEnabled,
  gestureScoreEnabled = false,
  manualScoreEnabled = false,
  friendly,
  sessionId,
  competitionId,
  gameRoundId,
  courtsForGame,
  courtIdByLabel,
  matchForCourt,
  scoreUnit,
  canEdit,
  onSubmitScores,
  onSaved,
  playTo,
  courtScoreMax,
  isLiveNow,
  isCurrentGame,
  countdown,
  countdownLabelText,
  finished,
  collapsed,
  onToggleCollapsed,
  currentUserId,
  currentUserDisplayName,
  currentUserAvatarUrl,
  duoTeamLabels,
  liveCourtScores,
  liveCourtFeeds,
  tvCompact = false,
  tvNav,
  onBack,
  viewAlongUrl,
  t,
}: {
  game: ScoringGame
  displayTimeLabel: string
  liveCourtEnabled: boolean
  gestureScoreEnabled?: boolean
  manualScoreEnabled?: boolean
  friendly: boolean
  sessionId?: string
  competitionId?: string
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt: NonNullable<MatchForCourt>
  scoreUnit: AmericanoScoringUnit
  canEdit: boolean
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void | Promise<void>
  playTo?: number
  courtScoreMax?: number
  isLiveNow: boolean
  isCurrentGame: boolean
  countdown?: string | null
  countdownLabelText: string
  finished: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  currentUserId?: string | null
  currentUserDisplayName?: string | null
  currentUserAvatarUrl?: string | null
  duoTeamLabels?: DuoTeamLabels
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  liveCourtFeeds?: Map<string, LiveCourtPointFeed>
  tvCompact?: boolean
  tvNav?: TvGameNav
  onBack?: () => void
  viewAlongUrl?: string | null
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
    playTo,
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
      tvCompact={tvCompact}
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
        hideCollapse={tvCompact}
        tvCompact={tvCompact}
        tvNav={tvNav}
        onBack={onBack}
        viewAlongUrl={viewAlongUrl}
        t={t}
      />
      {!collapsed && (
        <div className={tvCourtsBodyClass(tvCompact, finished)}>
          <GameScoringCourts
            game={game}
            courtsForGame={courtsForGame}
            scoreUnit={scoreUnit}
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
            gestureScoreEnabled={gestureScoreEnabled}
            manualScoreEnabled={manualScoreEnabled}
            friendly={friendly}
            sessionId={sessionId}
            competitionId={competitionId}
            duoTeamLabels={duoTeamLabels}
            courtScoreMax={courtScoreMax}
            gameRoundId={gameRoundId}
            liveCourtScores={liveCourtScores}
            liveCourtFeeds={liveCourtFeeds}
            tvCompact={tvCompact}
            currentUserDisplayName={currentUserDisplayName}
            t={t}
          />
        </div>
      )}
    </GameCardShell>
  )
}

export function FriendlyManualGameCard({
  game,
  scoreUnit,
  liveCourtScores,
  liveCourtFeeds,
  gestureScoreEnabled = false,
  manualScoreEnabled = false,
  friendlySessionId,
  onSubmitFriendlyScores,
  onSaved,
  scoreSubmitEnabled = true,
  courtScoreMax,
  courtPlayTo,
  isLiveNow,
  isCurrentGame,
  countdown,
  countdownLabelText,
  finished,
  collapsed,
  onToggleCollapsed,
  onBack,
  currentUserId,
  currentUserDisplayName,
  currentUserAvatarUrl,
  tvCompact = false,
  tvNav,
  viewAlongUrl,
  t,
}: {
  game: ScoringGame
  scoreUnit: AmericanoScoringUnit
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  liveCourtFeeds?: Map<string, LiveCourtPointFeed>
  gestureScoreEnabled?: boolean
  manualScoreEnabled?: boolean
  friendlySessionId?: string
  onSubmitFriendlyScores?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void | Promise<void>
  scoreSubmitEnabled?: boolean
  courtScoreMax?: number
  courtPlayTo?: number
  isLiveNow: boolean
  isCurrentGame: boolean
  countdown?: string | null
  countdownLabelText: string
  finished: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  onBack?: () => void
  currentUserId?: string | null
  currentUserDisplayName?: string | null
  currentUserAvatarUrl?: string | null
  tvCompact?: boolean
  tvNav?: TvGameNav
  viewAlongUrl?: string | null
  t: TranslateFn
}) {
  const { courtScoreRows, setDraft, submitCourt, busyCourtKey, error, canEdit } = useFriendlyManualScoring({
    game,
    liveCourtScores,
    canEdit: Boolean(onSubmitFriendlyScores),
    onSubmit: onSubmitFriendlyScores,
    onSaved,
    playTo: courtPlayTo,
    t,
  })

  return (
    <GameCardShell
      gameNumber={game.gameNumber}
      finished={finished}
      isCurrentGame={isCurrentGame}
      tvCompact={tvCompact}
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
        onBack={onBack}
        hideCollapse={tvCompact}
        tvCompact={tvCompact}
        tvNav={tvNav}
        carouselHideLogo={Boolean(tvNav)}
        viewAlongUrl={viewAlongUrl}
        t={t}
      />
      {!collapsed && (
        <div className={tvCourtsBodyClass(tvCompact, finished)}>
          <div {...courtsGridProps(tvCompact, courtScoreRows.length)}>
              {courtScoreRows.map((row) => {
                const teamA = row.court.teamA
                const teamB = row.court.teamB
                const courtReady = row.canSubmit
                const courtScoreKey = liveCourtScoreKey(game.gameNumber, row.courtLabel)
                const liveScore = liveCourtScores?.get(courtScoreKey)
                const feed = liveCourtFeeds?.get(courtScoreKey)
                const gestureHref = courtGestureScoreHref({
                  gestureScoreEnabled,
                  friendly: true,
                  sessionId: friendlySessionId,
                  gameNumber: game.gameNumber,
                  courtLabel: row.courtLabel,
                  currentUserId,
                  currentUserDisplayName,
                  court: row.court,
                  finished,
                })
                const manualHref = courtManualScoreHref({
                  manualScoreEnabled,
                  friendly: true,
                  sessionId: friendlySessionId,
                  gameNumber: game.gameNumber,
                  courtLabel: row.courtLabel,
                  finished,
                  currentUserId,
                })
                const showTvFallbackScoring = Boolean(tvCompact && canEdit)
                return (
                  <CourtCard
                    key={row.courtLabel}
                    courtLabel={row.courtLabel}
                    currentUserId={currentUserId}
                    currentUserDisplayName={currentUserDisplayName}
                    court={row.court}
                    finished={finished}
                    gestureScoreHref={gestureHref}
                    gestureScoreLive={feed?.live}
                    manualScoreHref={manualHref}
                    tvCompact={tvCompact}
                    t={t}
                  >
                    {showTvFallbackScoring ? (
                      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
                        <CourtMatchCell
                          teamA={teamA}
                          teamB={teamB}
                          teamAPlayers={row.court.teamAPlayers}
                          teamBPlayers={row.court.teamBPlayers}
                          scoreUnit={scoreUnit}
                          disabled
                          finished={finished}
                          currentUserId={currentUserId}
                          currentUserDisplayName={currentUserDisplayName}
                          currentUserAvatarUrl={currentUserAvatarUrl}
                          embedded
                          compact={tvCompact}
                          t={t}
                        />
                        <CourtTvScorePanel
                          teamAStr={row.teamAStr}
                          teamBStr={row.teamBStr}
                          onScoreA={(v) => setDraft(row.courtKey, 'teamA', v)}
                          onScoreB={(v) => setDraft(row.courtKey, 'teamB', v)}
                          onSubmit={() => void submitCourt(row.courtKey)}
                          canEdit={canEdit}
                          canSubmit={canEdit && scoreSubmitEnabled && courtReady}
                          busy={busyCourtKey === row.courtKey}
                          finished={finished}
                          scoreMax={courtScoreMax}
                          errorMessage={
                            error?.courtKey === row.courtKey ? error.message : null
                          }
                          t={t}
                        />
                      </div>
                    ) : (
                      <CourtMatchCell
                        teamA={teamA}
                        teamB={teamB}
                        teamAPlayers={row.court.teamAPlayers}
                        teamBPlayers={row.court.teamBPlayers}
                        scoreUnit={scoreUnit}
                        scoreA={liveScore?.scoreA ?? row.teamAStr}
                        scoreB={liveScore?.scoreB ?? row.teamBStr}
                        onScoreA={canEdit ? (v) => setDraft(row.courtKey, 'teamA', v) : undefined}
                        onScoreB={canEdit ? (v) => setDraft(row.courtKey, 'teamB', v) : undefined}
                        disabled={!canEdit}
                        finished={finished}
                        scoreMax={courtScoreMax}
                        currentUserId={currentUserId}
                        currentUserDisplayName={currentUserDisplayName}
                        currentUserAvatarUrl={currentUserAvatarUrl}
                        embedded
                        compact={tvCompact}
                        t={t}
                      />
                    )}
                    <LiveScoreFeed points={feed?.points} compact={tvCompact} />
                    {canEdit && !tvCompact ? (
                      <>
                        <button
                          type="button"
                          disabled={
                            busyCourtKey === row.courtKey || !courtReady || !scoreSubmitEnabled
                          }
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
      )}
    </GameCardShell>
  )
}
