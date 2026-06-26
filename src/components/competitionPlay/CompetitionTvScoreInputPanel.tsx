import { useEffect } from 'react'
import type { TranslateFn } from '../../i18n'
import type { AmericanoScoringUnit } from '../../lib/competitionPresets'
import type { CourtScoreSubmit } from '../../lib/competitionScoreInput'
import type { CourtColumn } from '../../lib/competitionCourtBoard'
import { pivotScheduleByGame } from '../../lib/competitionCourtBoard'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import type { MatchTeam } from '../../lib/types'
import type { LiveCourt } from '../cards/gameBoardTypes'
import {
  courtIdForLabel,
  useGameScoring,
} from '../cards/GameCard'
import { PlayerAvatarLink } from '../PlayerAvatarLink'

const SCORE_BUTTONS = [0, 1, 2, 3, 4, 5, 6] as const

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

type DuoTeamLabels = (
  teamA: [string, string],
  teamB: [string, string],
  teamAPlayers?: CourtPlayer[],
  teamBPlayers?: CourtPlayer[],
) => { teamALabel?: string; teamBLabel?: string }

type Props = {
  columns: CourtColumn[]
  gameNumber?: number
  roundId?: string
  liveCourtsByGame?: Map<number, LiveCourt[]>
  courtIdByLabel?: Map<string, string>
  matchForCourt: MatchForCourt
  scoreUnit: AmericanoScoringUnit
  canEdit: boolean
  onSubmitScores: (entries: CourtScoreSubmit[]) => Promise<void>
  courtScoreMax?: number
  playTo?: number
  duoTeamLabels?: DuoTeamLabels
  competitionId?: string | null
  t: TranslateFn
}

function displayCourtName(label: string): string {
  const match = label.match(/^Court\s*(\d+)$/i)
  return match ? `Court ${match[1]}` : label
}

function fallbackPlayers(names: [string, string], players?: CourtPlayer[]): CourtPlayer[] {
  if (players?.length) return players
  return names.map((name) => ({
    id: null,
    rosterId: null,
    padelPlayerId: null,
    name: name || 'Player',
    avatarUrl: null,
  }))
}

function teamTuple(team: string[]): [string, string] {
  return [team[0] ?? '', team[1] ?? '']
}

function TeamScoreRow({
  label,
  players,
  score,
  onScore,
  disabled,
  competitionId,
}: {
  label?: string
  players: CourtPlayer[]
  score: string
  onScore: (value: string) => void
  disabled: boolean
  competitionId?: string | null
}) {
  const scoreLabel = label ?? players.map((player) => player.name).join(' and ')

  return (
    <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] items-center gap-2 rounded-lg border border-brand-primary/20 bg-brand-surface px-2 py-1 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
      <div className="min-w-0">
        {label ? (
          <p className="truncate pb-0.5 font-display text-xs font-extrabold leading-tight text-brand-primary dark:text-brand-text">
            {label}
          </p>
        ) : null}
        <div className="grid min-w-0 gap-0.5">
          {players.map((player, index) => (
            <div
              key={`${player.rosterId ?? player.id ?? player.name}-${index}`}
              className="grid min-w-0 grid-cols-[1.65rem_minmax(0,1fr)] items-center gap-1.5"
            >
              <PlayerAvatarLink
                displayName={player.name}
                avatarUrl={player.avatarUrl}
                profileId={player.id}
                padelPlayerId={player.padelPlayerId}
                competitionId={competitionId}
                disabled
                imgClassName="h-6 w-6 rounded-full object-cover ring-1 ring-brand-border/60"
              />
              <p className="truncate text-sm font-bold leading-tight text-brand-text dark:text-brand-text">
                {player.name}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div
        className="grid w-full min-w-0 grid-cols-7 gap-1"
        role="group"
        aria-label={scoreLabel}
      >
        {SCORE_BUTTONS.map((value) => {
          const scoreValue = String(value)
          const active = score === scoreValue
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onScore(scoreValue)}
              className={[
                'h-8 rounded-md border font-display text-base font-extrabold leading-none tabular-nums transition',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]',
                active
                  ? 'border-[#7dd3fc] bg-brand-primary text-[#7dd3fc] shadow-sm dark:border-[#7dd3fc] dark:bg-[#7dd3fc] dark:text-[#0b2a4a]'
                  : 'border-brand-primary/25 bg-brand-bg-alt text-brand-primary shadow-sm hover:border-[#7dd3fc]/70 hover:bg-[#7dd3fc]/10 dark:border-white/15 dark:bg-white/[0.07] dark:text-brand-text dark:hover:bg-white/[0.12]',
                disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
              ].join(' ')}
            >
              {value}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CourtScoreInputSection({
  courtRow,
  liveCourt,
  setDraft,
  submitCourt,
  busy,
  error,
  canEdit,
  duoTeamLabels,
  competitionId,
}: {
  courtRow: ReturnType<typeof useGameScoring>['courtScoreRows'][number]
  liveCourt?: LiveCourt
  setDraft: (courtId: string, side: 'teamA' | 'teamB', value: string) => void
  submitCourt: (courtId: string) => Promise<void>
  busy: boolean
  error?: string
  canEdit: boolean
  duoTeamLabels?: DuoTeamLabels
  competitionId?: string | null
}) {
  const court = courtRow.court
  useEffect(() => {
    if (!canEdit || busy || !courtRow.dirty || !courtRow.canSubmit) return
    const timeout = window.setTimeout(() => {
      void submitCourt(courtRow.courtId)
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [
    busy,
    canEdit,
    courtRow.canSubmit,
    courtRow.courtId,
    courtRow.dirty,
    courtRow.teamAStr,
    courtRow.teamBStr,
    submitCourt,
  ])

  if (!court) return null

  const teamA = teamTuple(liveCourt?.teamA ?? court.teamA)
  const teamB = teamTuple(liveCourt?.teamB ?? court.teamB)
  const teamAPlayers = fallbackPlayers(teamA, liveCourt?.teamAPlayers ?? court.teamAPlayers)
  const teamBPlayers = fallbackPlayers(teamB, liveCourt?.teamBPlayers ?? court.teamBPlayers)
  const sideLabels = duoTeamLabels?.(
    [teamA[0] ?? '', teamA[1] ?? ''],
    [teamB[0] ?? '', teamB[1] ?? ''],
    liveCourt?.teamAPlayers ?? court.teamAPlayers,
    liveCourt?.teamBPlayers ?? court.teamBPlayers,
  )
  const disabled = !canEdit

  return (
    <section className="relative flex min-h-0 flex-col gap-1 rounded-xl border border-brand-primary/30 bg-brand-bg-alt p-1.5 shadow-sm dark:border-white/12 dark:bg-white/[0.05]">
      <button
        type="button"
        disabled={!canEdit || busy || !courtRow.canSubmit}
        onClick={() => void submitCourt(courtRow.courtId)}
        className="absolute right-2 top-2 z-10 h-7 rounded-md border border-[#7dd3fc]/40 bg-[#7dd3fc]/15 px-2 text-[10px] font-black uppercase tracking-wide text-[#7dd3fc] shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35"
      >
        {busy ? '…' : 'Submit'}
      </button>
      <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg bg-brand-primary px-2.5 py-1.5 pr-16 dark:bg-white/[0.08]">
        <h3 className="font-display text-lg font-extrabold leading-none text-[#7dd3fc]">
          {displayCourtName(courtRow.courtLabel)}
        </h3>
        {busy ? <span className="text-[11px] font-bold text-[#7dd3fc]">Saving</span> : null}
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-2 gap-1">
        <TeamScoreRow
          label={sideLabels?.teamALabel}
          players={teamAPlayers}
          score={courtRow.teamAStr}
          onScore={(value) => setDraft(courtRow.courtId, 'teamA', value)}
          disabled={disabled}
          competitionId={competitionId}
        />
        <TeamScoreRow
          label={sideLabels?.teamBLabel}
          players={teamBPlayers}
          score={courtRow.teamBStr}
          onScore={(value) => setDraft(courtRow.courtId, 'teamB', value)}
          disabled={disabled}
          competitionId={competitionId}
        />
      </div>
      {error ? <p className="text-center text-xs font-semibold text-red-600">{error}</p> : null}
    </section>
  )
}

export function CompetitionTvScoreInputPanel({
  columns,
  gameNumber,
  roundId,
  liveCourtsByGame,
  courtIdByLabel,
  matchForCourt,
  canEdit,
  onSubmitScores,
  playTo,
  duoTeamLabels,
  competitionId,
  t,
}: Props) {
  const game = pivotScheduleByGame(columns).find((row) => row.gameNumber === gameNumber)
  const courtsForGame = gameNumber != null ? (liveCourtsByGame?.get(gameNumber) ?? []) : []
  const scoring = useGameScoring({
    game: game ?? { gameNumber: gameNumber ?? 0, timeLabel: '', courts: [] },
    gameRoundId: roundId,
    courtsForGame,
    courtIdByLabel,
    matchForCourt,
    canEdit,
    onSubmitScores,
    playTo,
    t,
  })

  if (!game || !gameNumber) {
    return (
      <div className="px-3 py-6 text-center text-sm text-brand-muted">
        {t('competition.courtLayoutNotReady')}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className="grid min-h-0 flex-1 gap-1.5 overflow-hidden px-2 py-1.5"
        style={{ gridTemplateRows: `repeat(${Math.max(1, scoring.courtScoreRows.length)}, minmax(0, 1fr))` }}
      >
        {scoring.courtScoreRows.map((row, index) => {
          const liveCourt = courtsForGame.find((court) => court.courtName === row.courtLabel)
          const courtId =
            row.courtId ??
            courtIdForLabel(row.courtLabel, index, courtsForGame, courtIdByLabel)
          if (!courtId) return null
          const courtError = scoring.error?.courtId === courtId ? scoring.error.message : undefined
          return (
            <CourtScoreInputSection
              key={courtId}
              courtRow={{ ...row, courtId }}
              liveCourt={liveCourt}
              setDraft={scoring.setDraft}
              submitCourt={scoring.submitCourt}
              busy={scoring.busyCourtKey === courtId}
              error={courtError}
              canEdit={scoring.canEdit && Boolean(roundId)}
              duoTeamLabels={duoTeamLabels}
              competitionId={competitionId}
            />
          )
        })}
      </div>
    </div>
  )
}
