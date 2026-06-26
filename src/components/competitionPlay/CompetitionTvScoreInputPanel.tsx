import type { TranslateFn } from '../../i18n'
import type { AmericanoScoringUnit } from '../../lib/competitionPresets'
import type { CourtScoreSubmit } from '../../lib/competitionScoreInput'
import type { CourtColumn } from '../../lib/competitionCourtBoard'
import { pivotScheduleByGame } from '../../lib/competitionCourtBoard'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import type { MatchTeam } from '../../lib/types'
import type { LiveCourt } from '../cards/gameBoardTypes'
import { ScoreStepper } from '../cards/CourtCard'
import {
  courtIdForLabel,
  useGameScoring,
} from '../cards/GameCard'
import { PlayerAvatarLink } from '../PlayerAvatarLink'

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
  scoreMax,
  competitionId,
}: {
  label?: string
  players: CourtPlayer[]
  score: string
  onScore: (value: string) => void
  disabled: boolean
  scoreMax?: number
  competitionId?: string | null
}) {
  return (
    <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-brand-border/50 bg-brand-surface px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.05]">
      <div className="min-w-0 space-y-1">
        {label ? (
          <p className="truncate font-display text-base font-bold leading-tight text-brand-primary dark:text-brand-text">
            {label}
          </p>
        ) : null}
        <div className="grid min-w-0 gap-1">
          {players.map((player, index) => (
            <div
              key={`${player.rosterId ?? player.id ?? player.name}-${index}`}
              className="grid min-w-0 grid-cols-[2.1rem_minmax(0,1fr)] items-center gap-2"
            >
              <PlayerAvatarLink
                displayName={player.name}
                avatarUrl={player.avatarUrl}
                profileId={player.id}
                padelPlayerId={player.padelPlayerId}
                competitionId={competitionId}
                disabled
                imgClassName="h-8 w-8 rounded-full object-cover"
              />
              <p className="truncate text-base font-bold leading-tight text-brand-text dark:text-brand-text">
                {player.name}
              </p>
            </div>
          ))}
        </div>
      </div>
      <ScoreStepper
        value={score}
        onChange={onScore}
        disabled={disabled}
        ariaLabel={label ?? players.map((player) => player.name).join(' and ')}
        scoreMax={scoreMax}
        tv
      />
    </div>
  )
}

function CourtScoreInputSection({
  courtRow,
  liveCourt,
  scoreUnit,
  setDraft,
  submitCourt,
  busy,
  error,
  canEdit,
  courtScoreMax,
  duoTeamLabels,
  competitionId,
  t,
}: {
  courtRow: ReturnType<typeof useGameScoring>['courtScoreRows'][number]
  liveCourt?: LiveCourt
  scoreUnit: AmericanoScoringUnit
  setDraft: (courtId: string, side: 'teamA' | 'teamB', value: string) => void
  submitCourt: (courtId: string) => Promise<void>
  busy: boolean
  error?: string
  canEdit: boolean
  courtScoreMax?: number
  duoTeamLabels?: DuoTeamLabels
  competitionId?: string | null
  t: TranslateFn
}) {
  const court = courtRow.court
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
    <section className="space-y-2 rounded-xl border border-brand-border/70 bg-brand-bg-alt/70 p-2 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="font-display text-xl font-extrabold leading-none text-brand-primary dark:text-brand-text">
          {displayCourtName(courtRow.courtLabel)}
        </h3>
        <span className="text-xs font-semibold text-brand-muted">
          {scoreUnit === 'games' ? t('competition.scoreGames') : t('common.submit')}
        </span>
      </div>
      <TeamScoreRow
        label={sideLabels?.teamALabel}
        players={teamAPlayers}
        score={courtRow.teamAStr}
        onScore={(value) => setDraft(courtRow.courtId, 'teamA', value)}
        disabled={disabled}
        scoreMax={courtScoreMax}
        competitionId={competitionId}
      />
      <TeamScoreRow
        label={sideLabels?.teamBLabel}
        players={teamBPlayers}
        score={courtRow.teamBStr}
        onScore={(value) => setDraft(courtRow.courtId, 'teamB', value)}
        disabled={disabled}
        scoreMax={courtScoreMax}
        competitionId={competitionId}
      />
      <button
        type="button"
        disabled={disabled || busy || !courtRow.canSubmit}
        onClick={() => void submitCourt(courtRow.courtId)}
        className="brand-btn w-full py-2 text-sm font-extrabold disabled:opacity-40"
      >
        {busy ? '...' : t('common.submit')}
      </button>
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
  scoreUnit,
  canEdit,
  onSubmitScores,
  courtScoreMax,
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
      <div className="shrink-0 border-b border-brand-border/60 px-3 py-2 dark:border-white/10">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          Score input
        </p>
        <h2 className="font-display text-2xl font-extrabold leading-tight text-brand-primary dark:text-brand-text">
          Game {game.gameNumber}
        </h2>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2">
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
              scoreUnit={scoreUnit}
              setDraft={scoring.setDraft}
              submitCourt={scoring.submitCourt}
              busy={scoring.busyCourtKey === courtId}
              error={courtError}
              canEdit={scoring.canEdit && Boolean(roundId)}
              courtScoreMax={courtScoreMax}
              duoTeamLabels={duoTeamLabels}
              competitionId={competitionId}
              t={t}
            />
          )
        })}
      </div>
    </div>
  )
}
