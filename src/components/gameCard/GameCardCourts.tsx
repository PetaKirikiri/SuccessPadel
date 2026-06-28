import { useRef, useSyncExternalStore } from 'react'
import { useCourtsGridMetrics } from '../../hooks/useCourtsGridMetrics'
import { liveCourtScoreKey } from '../../lib/liveCourtScore'
import type { AmericanoScoringUnit } from '../../lib/competitionPresets'
import type { TranslateFn } from '../../i18n'
import type { GameCardSize } from '../../lib/viewBreakpoints'
import { LiveScoreFeed } from '../LiveScoreFeed'
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
  t: TranslateFn
}) {
  const landscape = useLandscapeOrientation()
  const compact = courtCompactForSize(size, landscape)
  const gridRef = useRef<HTMLDivElement>(null)
  const courtCount = courtScoreRows.length
  useCourtsGridMetrics(gridRef, courtCount, size, landscape)
  const gridProps = courtsGridProps(size, courtCount)

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
          courtIdForLabel(row.courtLabel, courtIndex, courtsForGame, courtIdByLabel)
        const court = row.court
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
        const courtScoreKey = liveCourtScoreKey(game.gameNumber, row.courtLabel)
        const liveScore = liveCourtScores?.get(courtScoreKey)
        const feed = liveCourtFeeds?.get(courtScoreKey)
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

        const scoreA =
          liveScore?.scoreA ??
          (hasScoring ? row.teamAStr : saved?.teamAPoints != null ? String(saved.teamAPoints) : undefined)
        const scoreB =
          liveScore?.scoreB ??
          (hasScoring ? row.teamBStr : saved?.teamBPoints != null ? String(saved.teamBPoints) : undefined)

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
              finished={finished}
              currentUserId={currentUserId}
              currentUserDisplayName={currentUserDisplayName}
              currentUserAvatarUrl={currentUserAvatarUrl}
              embedded
              compact={compact}
              showScores={false}
              t={t}
            />
            <LiveScoreFeed points={feed?.points} compact={compact} />
          </CourtCard>
        )
      })}
    </div>
  )
}
