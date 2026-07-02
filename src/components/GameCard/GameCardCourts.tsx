import { useRef, useSyncExternalStore } from 'react'
import { useCourtsGridMetrics } from '../../hooks/useCourtsGridMetrics'
import { liveCourtScoreKey, resolveGestureCourtPointScores, liveCourtGameResults } from '../../lib/liveCourtScore'
import type { AmericanoScoringUnit } from '../../lib/competitionPresets'
import type { TranslateFn } from '../../i18n'
import type { GameCardSize } from '../../lib/viewBreakpoints'
import {
  CourtCard,
  CourtMatchCell,
  courtGestureScoreHref,
  courtLiveHref,
  courtManualScoreHref,
} from './CourtCard'
import type { LiveCourt } from './gameBoardTypes'
import { courtIdForLabel } from './courtIdForLabel'
import { courtCompactForSize, courtsGridProps } from './gameCardSizes'
import type {
  DuoTeamLabels,
  GameCardCourtRow,
  MatchForCourt,
  ScoringGame,
} from './types'
import type { LiveCourtGamesScore, LiveCourtPointFeed } from '../../lib/liveCourtScore'
import { debugSessionLog } from '../../lib/debug/devDebug'
import type { LeaderboardEntry } from '../../lib/leaderboardTypes'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import { rosterDisplayName, type CompetitionPlayer } from '../../hooks/useCompetitions'

function useLandscapeOrientation(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia('(orientation: landscape)')
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia('(orientation: landscape)').matches,
    () => true,
  )
}

export function GameCardCourts({
  game,
  size,
  scoreUnit,
  courtScoreRows,
  courtsForGame,
  courtIdByLabel,
  gameRoundId,
  matchForCourt,
  setDraft: _setDraft,
  submitCourt: _submitCourt,
  busyCourtKey: _busyCourtKey,
  courtError: _courtError,
  canEdit,
  canSubmitScores: _canSubmitScores,
  hasScoring,
  finished,
  currentUserId,
  currentUserDisplayName,
  currentUserAvatarUrl,
  liveCourtEnabled = false,
  gestureScoreEnabled = false,
  manualScoreEnabled = false,
  friendly = false,
  competitionId,
  sessionId,
  duoTeamLabels,
  courtScoreMax: _courtScoreMax,
  liveCourtScores,
  liveCourtFeeds,
  courtStandings,
  roster,
  rosterNameById,
  t,
}: {
  game: ScoringGame
  size: GameCardSize
  scoreUnit: AmericanoScoringUnit
  courtScoreRows: GameCardCourtRow[]
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  gameRoundId?: string
  matchForCourt?: MatchForCourt
  setDraft: (courtKey: string, side: 'teamA' | 'teamB', value: string) => void
  submitCourt?: (courtKey: string) => Promise<void>
  busyCourtKey?: string | null
  courtError?: { courtKey: string; message: string } | null
  canEdit: boolean
  canSubmitScores: boolean
  hasScoring: boolean
  finished: boolean
  currentUserId?: string | null
  currentUserDisplayName?: string | null
  currentUserAvatarUrl?: string | null
  liveCourtEnabled?: boolean
  gestureScoreEnabled?: boolean
  manualScoreEnabled?: boolean
  friendly?: boolean
  competitionId?: string
  sessionId?: string
  duoTeamLabels?: DuoTeamLabels
  courtScoreMax?: number
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  liveCourtFeeds?: Map<string, LiveCourtPointFeed>
  courtStandings?: LeaderboardEntry[]
  roster?: CompetitionPlayer[]
  rosterNameById?: Map<string, string>
  t: TranslateFn
}) {
  const landscape = useLandscapeOrientation()
  const compact = courtCompactForSize(size, landscape)
  const scoreFirst = size === 'mobile' && !landscape
  const gridRef = useRef<HTMLDivElement>(null)
  const courtCount = courtScoreRows.length
  useCourtsGridMetrics(gridRef, courtCount, size, landscape)
  const gridProps = courtsGridProps(size, courtCount)

  const enrichCourtPlayer = (
    player: CourtPlayer | undefined,
    fallback: string,
  ): CourtPlayer | undefined => {
    if (!player || !roster?.length) return player
    const row = player.rosterId ? roster.find((r) => r.id === player.rosterId) : undefined
    const name = row ? rosterDisplayName(row) : fallback
    if (!name || name === 'Player') return player
    return { ...player, name }
  }

  const enrichCourtSide = (
    names: string[],
    players: CourtPlayer[] | undefined,
  ): { names: string[]; players: CourtPlayer[] | undefined } => {
    if (!roster?.length) return { names, players }
    const enrichedPlayers = players?.map((player, index) =>
      enrichCourtPlayer(player, names[index] ?? ''),
    )
    return {
      names: [
        enrichedPlayers?.[0]?.name ?? names[0] ?? '',
        enrichedPlayers?.[1]?.name ?? names[1] ?? '',
      ],
      players: enrichedPlayers,
    }
  }

  return (
    <div
      ref={gridRef}
      className={gridProps.className}
      style={gridProps.style}
    >
      {courtScoreRows.map((row, courtIndex) => {
        const liveCourt = courtsForGame.find((c) => c.courtName === row.courtLabel)
        const courtId =
          row.courtId ??
          liveCourt?.courtId ??
          courtIdForLabel(row.courtLabel, courtIndex, courtsForGame, courtIdByLabel)
        const court = row.court
        const rawTeamA = liveCourt?.teamA ?? court.teamA
        const rawTeamB = liveCourt?.teamB ?? court.teamB
        const rawTeamAPlayers = liveCourt?.teamAPlayers ?? court.teamAPlayers
        const rawTeamBPlayers = liveCourt?.teamBPlayers ?? court.teamBPlayers
        const sideA = enrichCourtSide(rawTeamA, rawTeamAPlayers)
        const sideB = enrichCourtSide(rawTeamB, rawTeamBPlayers)
        const teamA = sideA.names
        const teamB = sideB.names
        const teamAPlayers = sideA.players
        const teamBPlayers = sideB.players
        // #region agent log
        if (import.meta.env.DEV && courtIndex < 4) {
          debugSessionLog(
            'GameCardCourts.tsx',
            'court card name inputs',
            {
              runId: 'post-fix-3',
              gameNumber: game.gameNumber,
              courtLabel: row.courtLabel,
              usedLiveCourt: Boolean(liveCourt),
              teamA,
              teamB,
              liveTeamA: liveCourt?.teamA ?? null,
              schedTeamA: court.teamA,
              playerNames: [
                teamAPlayers?.[0]?.name ?? null,
                teamAPlayers?.[1]?.name ?? null,
                teamBPlayers?.[0]?.name ?? null,
                teamBPlayers?.[1]?.name ?? null,
              ],
              rosterIds: [
                teamAPlayers?.[0]?.rosterId ?? null,
                teamAPlayers?.[1]?.rosterId ?? null,
                teamBPlayers?.[0]?.rosterId ?? null,
                teamBPlayers?.[1]?.rosterId ?? null,
              ],
            },
            'H-G',
            '5d6061',
          )
        }
        // #endregion
        const sideLabels = duoTeamLabels?.(
          [teamA[0] ?? '', teamA[1] ?? ''],
          [teamB[0] ?? '', teamB[1] ?? ''],
          teamAPlayers,
          teamBPlayers,
        )
        const courtScoreKey = liveCourtScoreKey(game.gameNumber, row.courtLabel)
        let liveScore = liveCourtScores?.get(courtScoreKey)
        let feed = liveCourtFeeds?.get(courtScoreKey)
        // Logs keyed by court UUID when club name lookup fails — try that key too.
        if (courtId && (!feed || !liveScore)) {
          const altKey = liveCourtScoreKey(game.gameNumber, courtId)
          liveScore = liveScore ?? liveCourtScores?.get(altKey)
          feed = feed ?? liveCourtFeeds?.get(altKey)
        }
        const saved =
          gameRoundId && courtId && matchForCourt
            ? matchForCourt(gameRoundId, courtId)
            : undefined

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
          canEditScores: canEdit && hasScoring,
        })

        // Score column + 0-0 default whenever gesture scoring is on for this session —
        // not only when we already resolved a gesture-score URL (courtId can lag on first paint).
        const gestureCourt = gestureScoreEnabled && !finished
        const trackingLive = feed?.live ?? false
        let scoreA =
          liveScore?.scoreA ??
          (trackingLive ? '0' : hasScoring && row.teamAStr ? row.teamAStr : saved?.teamAPoints != null ? String(saved.teamAPoints) : undefined)
        let scoreB =
          liveScore?.scoreB ??
          (trackingLive ? '0' : hasScoring && row.teamBStr ? row.teamBStr : saved?.teamBPoints != null ? String(saved.teamBPoints) : undefined)
        // Camera courts always show the score column — 0-0 before the first point lands.
        if (gestureCourt) {
          if (scoreA == null || scoreA === '') scoreA = '0'
          if (scoreB == null || scoreB === '') scoreB = '0'
        }
        const courtFinished =
          finished || Boolean(feed && feed.live === false && (feed.points.length > 0 || trackingLive))
        const scoringLive = trackingLive && !courtFinished
        const gestureScoring = gestureScoreEnabled && Boolean(feed || trackingLive || liveScore)
        const pointScores = resolveGestureCourtPointScores(
          feed,
          scoringLive || Boolean(feed?.live),
          gestureScoring,
        )
        const gameResults = liveCourtGameResults(feed?.points)
        const hasCourtScores =
          gestureCourt ||
          (scoreA != null && scoreA !== '') ||
          (scoreB != null && scoreB !== '') ||
          pointScores != null

        return (
          <CourtCard
            key={row.courtLabel}
            courtLabel={row.courtLabel}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            court={liveCourt ?? court}
            finished={courtFinished}
            href={href}
            gestureScoreHref={gestureHref}
            gestureScoreLive={feed?.live}
            manualScoreHref={manualHref}
            size={size}
            fillCell={compact}
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
              scoreA={scoreA}
              scoreB={scoreB}
              livePointScores={gestureScoring ? pointScores : undefined}
              liveGameResults={gameResults}
              finished={courtFinished}
              currentUserId={currentUserId}
              currentUserDisplayName={currentUserDisplayName}
              currentUserAvatarUrl={currentUserAvatarUrl}
              embedded
              compact={compact}
              scoreFirst={scoreFirst}
              showScores={hasCourtScores}
              t={t}
            />
          </CourtCard>
        )
      })}
    </div>
  )
}
