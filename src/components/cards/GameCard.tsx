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
} from '../../lib/competitionScoreInput'
import { liveCourtScoreKey, type LiveCourtGamesScore } from '../../lib/liveCourtScore'
import type { FriendlyCourtScoreSubmit } from '../../lib/friendlyManualScore'
import type { MatchTeam } from '../../lib/types'
import { TvPlayQrPanel } from '../competitionPlay/TvPlayQrPanel'
import type { TvGameNav } from '../competitionPlay/CompetitionTvGameCarousel'
import { CourtCard, CourtMatchCell, courtLiveHref } from './CourtCard'
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
  const otherSide = side === 'teamA' ? 'teamB' : 'teamA'
  if (next[otherSide] === '') next[otherSide] = '0'
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
  return `tv-game-courts-body border-t flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-0 pt-1.5 ${
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
  currentUserAvatarUrl,
  liveCourtEnabled,
  friendly,
  sessionId,
  competitionId,
  duoTeamLabels,
  courtScoreMax,
  gameRoundId,
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
  currentUserAvatarUrl?: string | null
  liveCourtEnabled: boolean
  friendly: boolean
  sessionId?: string
  competitionId?: string
  duoTeamLabels?: DuoTeamLabels
  courtScoreMax?: number
  gameRoundId?: string
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
            tvCompact={tvCompact}
            t={t}
          >
            <CourtMatchCell
              teamA={teamA}
              teamB={teamB}
              teamAPlayers={teamAPlayers}
              teamBPlayers={teamBPlayers}
              teamALabel={sideLabels?.teamALabel}
              teamBLabel={sideLabels?.teamBLabel}
              scoreUnit={scoreUnit}
              scoreA={row.teamAStr}
              scoreB={row.teamBStr}
              onScoreA={
                canEdit && courtId && gameRoundId ? (v) => setDraft(courtId, 'teamA', v) : undefined
              }
              onScoreB={
                canEdit && courtId && gameRoundId ? (v) => setDraft(courtId, 'teamB', v) : undefined
              }
              disabled={!canEdit}
              finished={finished}
              scoreMax={courtScoreMax}
              currentUserId={currentUserId}
              currentUserAvatarUrl={currentUserAvatarUrl}
              embedded
              compact={tvCompact}
              t={t}
            />
            {canEdit && submitCourt && gameRoundId ? (
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
  const navBtnClass = finished
    ? 'text-[#602d24]/80 hover:bg-[#602d24]/5'
    : 'text-[#7dd3fc] hover:bg-[#7dd3fc]/10'

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
        <div className={`relative grid min-h-[5.75rem] min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 ${headerPad}`}>
          {onBack ? (
            <button
              type="button"
              className="absolute left-3 top-2 z-20 shrink-0 px-1 py-0.5 text-sm font-black uppercase tracking-wide text-[#7dd3fc]/75 transition hover:text-[#7dd3fc]"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onBack()
              }}
              aria-label={t('aria.back')}
            >
              Back
            </button>
          ) : null}
          <div className="flex min-w-0 items-center gap-2 justify-self-start">
            <button
              type="button"
              className={`tv-game-header-nav shrink-0 ${navBtnClass}`}
              disabled={tvNav.atStart}
              onClick={tvNav.onPrev}
              aria-label={t('competition.prevGame')}
            >
              <span aria-hidden="true">‹</span>
            </button>
          </div>
          <div className="pointer-events-none relative flex min-w-0 items-center justify-center justify-self-center">
            <img
              src="/brand/logo-padel.webp"
              alt=""
              aria-hidden="true"
              className="absolute right-full mr-5 h-16 w-auto max-w-[11rem] shrink-0 object-contain"
            />
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
          <div className="flex min-w-0 items-center justify-end gap-2 justify-self-end">
            {countdownBlock}
            {viewAlongUrl ? <TvPlayQrPanel url={viewAlongUrl} header /> : null}
            <button
              type="button"
              className={`tv-game-header-nav shrink-0 ${navBtnClass}`}
              disabled={tvNav.atEnd}
              onClick={tvNav.onNext}
              aria-label={t('competition.nextGame')}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={headerShellClass}>
      <div className={`flex min-w-0 flex-1 items-center gap-2 md:gap-3 ${headerPad}`}>
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
  currentUserAvatarUrl,
  duoTeamLabels,
  tvCompact = false,
  tvNav,
  onBack,
  viewAlongUrl,
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
  currentUserAvatarUrl?: string | null
  duoTeamLabels?: DuoTeamLabels
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
            friendly={friendly}
            sessionId={sessionId}
            competitionId={competitionId}
            duoTeamLabels={duoTeamLabels}
            courtScoreMax={courtScoreMax}
            gameRoundId={gameRoundId}
            tvCompact={tvCompact}
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
  onSubmitFriendlyScores,
  onSaved,
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
  currentUserAvatarUrl,
  t,
}: {
  game: ScoringGame
  scoreUnit: AmericanoScoringUnit
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  onSubmitFriendlyScores?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void | Promise<void>
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
  currentUserAvatarUrl?: string | null
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
                      scoreMax={courtScoreMax}
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
