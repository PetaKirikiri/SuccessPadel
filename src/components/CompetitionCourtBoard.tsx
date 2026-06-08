import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GestureAnnotationPad } from './GestureAnnotationPad'
import { useTranslation } from '../hooks/useTranslation'
import type { TranslateFn } from '../i18n'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { pivotScheduleByGame, type CourtColumn } from '../lib/competitionCourtBoard'
import { isScoringTimeUnlocked } from '../lib/competitionScoringUnlock'
import { playTwoMinuteAlarm, TWO_MINUTES_MS } from '../lib/gameCountdownAlarm'
import { RANKED_GAME_MINUTES } from '../lib/competitionLayout'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import {
  effectiveScoreField,
  parseScoreField,
  scoreDigitsOnly,
} from '../lib/competitionScoreInput'
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
  competitionId?: string
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

function gameCardShellClass({
  finished,
  isCurrentGame,
  isMyGame = false,
}: {
  finished: boolean
  isCurrentGame: boolean
  isMyGame?: boolean
}) {
  const parts = ['game-card overflow-hidden p-0 transition-colors']
  if (finished) {
    parts.push(
      'border border-brand-border/50 !bg-[#f6f5f3] shadow-none',
    )
  } else if (isCurrentGame) {
    parts.push('border-2 border-brand-accent ring-2 ring-brand-accent/30')
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
  'text-center font-display text-xl font-bold text-brand-primary md:text-2xl'
const CURRENT_PLAYER_HIGHLIGHT_CLASS =
  'animate-pulse rounded bg-brand-bg-alt px-1 text-brand-accent'

function courtLabelClass(
  currentUserId: string | null | undefined,
  court: Parameters<typeof courtHasCurrentUser>[1],
  finished = false,
) {
  const base = finished
    ? 'text-center font-display text-xl font-bold text-brand-sage md:text-2xl'
    : 'text-center font-display text-xl font-bold md:text-2xl'
  return courtHasCurrentUser(currentUserId, court)
    ? `${base} ${CURRENT_PLAYER_HIGHLIGHT_CLASS}`
    : finished
      ? base
      : COURT_LABEL_CLASS
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
  finished?: boolean
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
      isCurrent
        ? CURRENT_PLAYER_HIGHLIGHT_CLASS
        : finished
          ? 'px-0 text-brand-muted'
          : 'px-0 text-brand-text'
    }`

  const scoreInputClass = finished
    ? 'h-8 w-8 rounded-lg border border-brand-border/50 bg-[#faf9f7] px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-brand-sage disabled:text-brand-muted/60 md:h-10 md:w-10 md:text-base'
    : 'h-8 w-8 rounded-lg border border-brand-border/80 bg-brand-surface px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-brand-primary disabled:text-brand-muted/60 md:h-10 md:w-10 md:text-base'

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
      className={
        finished
          ? 'overflow-hidden rounded-lg border border-brand-border/40 bg-[#f3f2f0]'
          : 'overflow-hidden rounded-lg border border-brand-border/60 bg-brand-surface'
      }
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
  finished,
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
  finished: boolean
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void
  t: TranslateFn
}) {
  const [drafts, setDrafts] = useState<Record<string, CourtDraft>>({})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    return scoringCourts.map(({ courtId }) => {
      const draft = drafts[courtId]
      const saved = matchForCourt(gameRoundId, courtId)
      const { teamAStr, teamBStr } = scoreStringsForCourt(draft, saved, dirty)
      const teamA = parseScoreField(teamAStr)
      const teamB = parseScoreField(teamBStr)
      return { courtId, teamA, teamB, teamAStr, teamBStr, saved }
    })
  }, [dirty, drafts, gameRoundId, matchForCourt, scoringCourts])

  const allCourtsReady =
    scoringCourts.length > 0 &&
    courtScoreRows.length === scoringCourts.length &&
    courtScoreRows.every((row) => row.teamA !== null && row.teamB !== null)

  const submitEntries = useMemo((): CourtScoreSubmit[] => {
    if (!gameRoundId || !allCourtsReady) return []
    return courtScoreRows
      .filter((row) => row.teamA !== null && row.teamB !== null)
      .map((row) => ({
        roundId: gameRoundId,
        courtId: row.courtId,
        teamA: row.teamA!,
        teamB: row.teamB!,
      }))
  }, [allCourtsReady, courtScoreRows, gameRoundId])

  const submitGame = async () => {
    if (!onSubmitScores || submitEntries.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await onSubmitScores(submitEntries)
      setDirty(false)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.submitFailed'))
    } finally {
      setBusy(false)
    }
  }

  const submitFooter = onSubmitScores ? (
    <div
      className={`border-t px-3 py-2.5 md:px-4 ${
        finished ? 'border-brand-border/40 bg-[#f1f0ee]' : 'border-brand-border/60'
      }`}
    >
      <button
        type="button"
        onClick={() => void submitGame()}
        className="brand-btn w-full py-2.5 text-sm font-semibold disabled:opacity-40"
      >
        {busy ? '…' : t('common.submit')}
      </button>
    </div>
  ) : null

  return { drafts, setDraft, submitFooter, error, canEdit, dirty }
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
  dirty,
  finished,
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
  drafts: Record<string, CourtDraft>
  setDraft: (courtId: string, side: 'teamA' | 'teamB', value: string) => void
  canEdit: boolean
  dirty: boolean
  finished: boolean
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  t: TranslateFn
}) {
  return (
    <div className="space-y-2">
      {game.courts.map((court, courtIndex) => {
        const liveCourt = courtsForGame.find((c) => c.courtName === court.courtLabel)
        const courtId = courtIdForLabel(
          court.courtLabel,
          courtIndex,
          courtsForGame,
          courtIdByLabel,
        )
        const teamA = liveCourt?.teamA ?? court.teamA
        const teamB = liveCourt?.teamB ?? court.teamB
        const teamAPlayers = liveCourt?.teamAPlayers ?? court.teamAPlayers
        const teamBPlayers = liveCourt?.teamBPlayers ?? court.teamBPlayers
        const saved = gameRoundId && courtId ? matchForCourt(gameRoundId, courtId) : undefined
        const draft = courtId ? drafts[courtId] : undefined
        const { teamAStr: scoreA, teamBStr: scoreB } = canEdit
          ? scoreStringsForCourt(draft, saved, dirty)
          : {
              teamAStr: saved?.teamAPoints != null ? String(saved.teamAPoints) : '',
              teamBStr: saved?.teamBPoints != null ? String(saved.teamBPoints) : '',
            }

        return (
          <div key={court.courtLabel} className="space-y-1">
            <p className={courtLabelClass(currentUserId, liveCourt ?? court, finished)}>
              {court.courtLabel}
            </p>
            <div>
              <CourtMatchCell
                teamA={teamA}
                teamB={teamB}
                teamAPlayers={teamAPlayers}
                teamBPlayers={teamBPlayers}
                scoreUnit={scoreUnit}
                scoreA={scoreA}
                scoreB={scoreB}
                onScoreA={
                  canEdit && courtId ? (v) => setDraft(courtId, 'teamA', v) : undefined
                }
                onScoreB={
                  canEdit && courtId ? (v) => setDraft(courtId, 'teamB', v) : undefined
                }
                disabled={!canEdit}
                finished={finished}
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

function GesturePadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-6 md:w-6" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 17 Q12 8 19 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function GameGesturePadButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-brand-border bg-brand-surface px-2 py-1.5 text-brand-muted transition hover:border-brand-accent/40 hover:text-brand-primary md:px-2.5 md:py-2"
      aria-label="Gesture pad"
    >
      <GesturePadIcon />
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide lg:inline lg:text-[11px]">
        Gesture
      </span>
    </button>
  )
}

function GesturePadOverlay({
  competitionId,
  gameNumber,
  onClose,
  t,
}: {
  competitionId: string
  gameNumber: number
  onClose: () => void
  t: TranslateFn
}) {
  return (
    <div className="gesture-pad-page fixed inset-0 z-[250] flex flex-col overflow-hidden bg-brand-surface">
      <div className="flex shrink-0 items-center gap-2 border-b border-brand-border/60 px-3 py-3 md:px-4">
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-sm font-medium text-brand-primary"
        >
          {t('common.back')}
        </button>
        <p className="min-w-0 flex-1 truncate text-center font-display text-base font-semibold text-brand-primary">
          {t('competition.game', { number: gameNumber })} · Gesture Pad
        </p>
        <span className="w-12 shrink-0" aria-hidden />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <GestureAnnotationPad
          competitionId={competitionId}
          gameNumber={String(gameNumber)}
        />
      </div>
    </div>
  )
}

function GameCardHeader({
  gameNumber,
  onOpenGesturePad,
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
  onOpenGesturePad?: () => void
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
      className={`flex items-center gap-2 border-b md:gap-3 ${
        finished ? 'border-brand-border/40 bg-[#f1f0ee]' : 'border-brand-border/60'
      }`}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left md:gap-3 md:px-4 md:py-4"
        aria-expanded={!collapsed}
      >
        <span className={`shrink-0 text-sm ${finished ? 'text-brand-sage/70' : 'text-brand-muted'}`}>
          {collapsed ? '▸' : '▾'}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block font-display text-2xl font-bold leading-none md:text-3xl ${
              finished ? 'text-brand-sage' : 'text-brand-primary'
            }`}
          >
            {t('competition.game', { number: gameNumber })}
            {isLiveNow ? (
              <span className="ml-1.5 text-sm font-medium text-brand-accent md:text-base">
                · {t('competition.live')}
              </span>
            ) : finished ? (
              <span className="ml-1.5 inline-flex items-center gap-1 text-sm font-medium text-brand-muted md:text-base">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-sage/60" aria-hidden />
                {t('competition.done')}
              </span>
            ) : null}
          </span>
          {timeLabel && (
            <span className="mt-1 block text-[11px] tabular-nums text-brand-muted md:text-sm">
              {timeLabel}
            </span>
          )}
        </span>
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
      </button>
      {onOpenGesturePad ? (
        <div className="flex shrink-0 items-center pr-3 md:pr-4">
          <GameGesturePadButton onOpen={onOpenGesturePad} />
        </div>
      ) : null}
    </div>
  )
}

function ScoringGameCard({
  game,
  onOpenGesturePad,
  gameRoundId,
  courtsForGame,
  courtIdByLabel,
  matchForCourt,
  scoreUnit,
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
  onOpenGesturePad?: () => void
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt: NonNullable<Props['matchForCourt']>
  scoreUnit: AmericanoScoringUnit
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
  const { drafts, setDraft, submitFooter, error, canEdit: editable, dirty } = useGameScoring({
    game,
    gameRoundId,
    courtsForGame,
    courtIdByLabel,
    matchForCourt,
    canEdit,
    finished,
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
    <div className={gameCardShellClass({ finished, isCurrentGame, isMyGame })}>
      <GameCardHeader
        gameNumber={game.gameNumber}
        onOpenGesturePad={onOpenGesturePad}
        isLiveNow={isLiveNow}
        timeLabel={game.timeLabel}
        countdown={countdown}
        countdownLabelText={countdownLabelText}
        finished={finished}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        t={t}
      />
      {error && <p className="px-3 pb-1 text-center text-xs text-red-600">{error}</p>}
      {!collapsed && (
        <>
          <div className={`px-1 pb-2 pt-2 ${finished ? 'bg-[#f6f5f3]' : ''}`}>
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
              dirty={dirty}
              finished={finished}
              currentUserId={currentUserId}
              currentUserAvatarUrl={currentUserAvatarUrl}
              t={t}
            />
          </div>
          {submitFooter}
        </>
      )}
    </div>
  )
}

export function CompetitionCourtBoard({
  competitionId,
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
  const [gesturePadGame, setGesturePadGame] = useState<number | null>(null)
  const scoringTimeUnlocked = isScoringTimeUnlocked()

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

  const orderedGames = useMemo(
    () =>
      [...games].sort((a, b) => {
        const aTimes = roundTimesByGame?.get(a.gameNumber)
        const bTimes = roundTimesByGame?.get(b.gameNumber)
        const aRoundId = roundIdForGame?.(a.gameNumber)
        const bRoundId = roundIdForGame?.(b.gameNumber)
        const aCourts = liveCourtsByGame?.get(a.gameNumber) ?? []
        const bCourts = liveCourtsByGame?.get(b.gameNumber) ?? []
        const aSubmitted =
          matchForCourt != null
            ? isGameSubmitted(a, aRoundId, aCourts, courtIdByLabel, matchForCourt)
            : false
        const bSubmitted =
          matchForCourt != null
            ? isGameSubmitted(b, bRoundId, bCourts, courtIdByLabel, matchForCourt)
            : false
        const aTimeUp = isGameTimeUp(a.gameNumber, clock, roundTimesByGame, roundStatusByGame)
        const bTimeUp = isGameTimeUp(b.gameNumber, clock, roundTimesByGame, roundStatusByGame)
        const aLive = isGameLive(clock, aTimes)
        const bLive = isGameLive(clock, bTimes)
        const aCurrent = !aSubmitted && (aLive || activeGameNumber === a.gameNumber)
        const bCurrent = !bSubmitted && (bLive || activeGameNumber === b.gameNumber)
        const rank = (
          isCurrent: boolean,
          submitted: boolean,
          timeUp: boolean,
          times?: { startsAt: number },
        ) => {
          if (isCurrent) return 0
          if (submitted) return 3
          if (timeUp) return 1
          if (times && clock < times.startsAt) return 2
          return 2
        }
        const aRank = rank(aCurrent, aSubmitted, aTimeUp, aTimes)
        const bRank = rank(bCurrent, bSubmitted, bTimeUp, bTimes)
        if (aRank !== bRank) return aRank - bRank
        return (aTimes?.startsAt ?? a.gameNumber) - (bTimes?.startsAt ?? b.gameNumber)
      }),
    [
      activeGameNumber,
      clock,
      courtIdByLabel,
      games,
      liveCourtsByGame,
      matchForCourt,
      roundIdForGame,
      roundStatusByGame,
      roundTimesByGame,
    ],
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
        const roundStatus = roundStatusByGame?.get(game.gameNumber)
        const courtsForGame = liveCourtsByGame?.get(game.gameNumber) ?? []
        const gameRoundId =
          roundIdForGame?.(game.gameNumber) ?? (isActive ? roundId : undefined)
        const isLiveNow = mode === 'scoring' && isGameLive(clock, times)
        const timeUp = isGameTimeUp(
          game.gameNumber,
          clock,
          roundTimesByGame,
          roundStatusByGame,
        )
        const submitted =
          matchForCourt != null
            ? isGameSubmitted(game, gameRoundId, courtsForGame, courtIdByLabel, matchForCourt)
            : timeUp && roundStatus === 'complete'
        const finished = submitted
        const countdown =
          mode === 'scoring' && !submitted
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

        const openGesturePad = competitionId
          ? () => setGesturePadGame(game.gameNumber)
          : undefined

        if (mode === 'scoring' && matchForCourt) {
          return (
            <ScoringGameCard
              key={game.gameNumber}
              game={game}
              onOpenGesturePad={openGesturePad}
              gameRoundId={gameRoundId}
              courtsForGame={courtsForGame}
              courtIdByLabel={courtIdByLabel}
              matchForCourt={matchForCourt}
              scoreUnit={scoreUnit}
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

        return (
          <div
            key={game.gameNumber}
            className={gameCardShellClass({ finished, isCurrentGame })}
          >
            <GameCardHeader
              gameNumber={game.gameNumber}
              onOpenGesturePad={openGesturePad}
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
              <div className={`px-1 pb-2 pt-2 ${finished ? 'bg-[#f6f5f3]' : ''}`}>
              <div className="space-y-2">
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
                  return (
                    <div key={court.courtLabel} className="space-y-1">
                      <p className={courtLabelClass(currentUserId, liveCourt ?? court, finished)}>
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
                          finished={finished}
                          currentUserId={currentUserId}
                          currentUserAvatarUrl={currentUserAvatarUrl}
                          t={t}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            )}
          </div>
        )
      })}
      {gesturePadGame != null && competitionId ? (
        <GesturePadOverlay
          competitionId={competitionId}
          gameNumber={gesturePadGame}
          onClose={() => setGesturePadGame(null)}
          t={t}
        />
      ) : null}
    </div>
  )
}
