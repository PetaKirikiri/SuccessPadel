import { useRef, useState, useSyncExternalStore } from 'react'
import { useCourtsGridMetrics } from '../../hooks/useCourtsGridMetrics'
import {
  liveCourtScoreKey,
  resolveGestureCourtPointScores,
} from '../../lib/liveCourtScore'
import {
  competitionCourtSetupKey,
  friendlyGestureCourtSetupKey,
  rosterFromCourt,
  syncGestureCameraGamesOverride,
  syncGestureCameraPointsOverride,
} from '../../lib/gestureCameraScore'
import { parseTennisPointInput } from '../../lib/tennisScore'
import type { AmericanoScoringUnit } from '../../lib/competitionPresets'
import type { TranslateFn } from '../../i18n'
import type { GameCardSize } from '../../lib/viewBreakpoints'
import {
  CourtCard,
  CourtMatchCell,
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
import { agentDebugIngest } from '../../lib/debug/devDebug'
import type { LeaderboardEntry } from '../../lib/leaderboardTypes'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import {
  resolveCourtPlayerDisplayName,
  rosterEntryGender,
  type CompetitionPlayer,
} from '../../hooks/useCompetitions'

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
  setDraft,
  submitCourt,
  busyCourtKey: _busyCourtKey,
  courtError: _courtError,
  canEdit,
  canSubmitScores: _canSubmitScores,
  hasScoring,
  finished,
  currentUserId,
  currentUserAvatarUrl: _currentUserAvatarUrl,
  liveCourtEnabled = false,
  gestureScoreEnabled = false,
  manualScoreEnabled = false,
  friendly = false,
  competitionId,
  sessionId,
  duoTeamLabels,
  courtScoreMax,
  liveCourtScores,
  liveCourtFeeds,
  onGestureGamesSynced,
  onCompetitionCourtGamesSaved,
  resolveCompetitionRoundId,
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
  onGestureGamesSynced?: (log: import('../../lib/matchLogServer').MatchGestureLog) => void
  onCompetitionCourtGamesSaved?: (
    gameNumber: number,
    courtId: string,
    teamA: number,
    teamB: number,
    courtLabel?: string,
  ) => Promise<void>
  resolveCompetitionRoundId?: (gameNumber: number) => Promise<string | undefined>
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
  const gamesDraftRef = useRef<Map<string, { a: string; b: string }>>(new Map())
  const gamesDirtyRef = useRef<Set<string>>(new Set())
  const pointsSyncTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [pointBackups, setPointBackups] = useState<Record<string, { a: string; b: string }>>({})
  const [pointBackupDirty, setPointBackupDirty] = useState<Set<string>>(() => new Set())
  useCourtsGridMetrics(gridRef, courtCount, size, landscape)
  const gridProps = courtsGridProps(size, courtCount)

  const enrichCourtPlayer = (
    player: CourtPlayer | undefined,
    fallback: string,
  ): CourtPlayer | undefined => {
    if (!player || !roster?.length) return player
    const name = resolveCourtPlayerDisplayName(
      player,
      fallback,
      roster,
      rosterNameById ?? new Map(),
      courtStandings ?? [],
    )
    const row = player.rosterId ? roster.find((r) => r.id === player.rosterId) : undefined
    const gender = player.gender ?? rosterEntryGender(row)
    if (!name || name === 'Player') return gender ? { ...player, gender } : player
    return { ...player, name, gender }
  }

  const enrichCourtSide = (
    names: string[],
    players: CourtPlayer[] | undefined,
  ): { names: string[]; players: CourtPlayer[] | undefined } => {
    if (!roster?.length) return { names, players }
    const enrichedPlayers = players?.map((player, index) =>
      enrichCourtPlayer(player, names[index] ?? ''),
    ).filter((player): player is CourtPlayer => Boolean(player))
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
        const showGesturePoints = gestureCourt
        const gestureScoring = showGesturePoints || Boolean(feed || trackingLive || liveScore)
        if (gestureScoring && row.teamAStr !== '' && row.teamAStr !== (liveScore?.scoreA ?? '')) {
          scoreA = row.teamAStr
        }
        if (gestureScoring && row.teamBStr !== '' && row.teamBStr !== (liveScore?.scoreB ?? '')) {
          scoreB = row.teamBStr
        }
        const pointScores = resolveGestureCourtPointScores(
          feed,
          showGesturePoints || scoringLive || Boolean(feed?.live),
          showGesturePoints,
        )
        const hasCourtScores =
          gestureCourt ||
          (scoreA != null && scoreA !== '') ||
          (scoreB != null && scoreB !== '') ||
          pointScores != null

        const gamesEditable =
          !courtFinished && (gestureCourt || (canEdit && hasScoring && Boolean(row.courtId || friendly)))

        const backupKey = row.courtKey ?? liveCourtScoreKey(game.gameNumber, row.courtLabel)
        const gamesDraftKey = backupKey
        const backupDirty = pointBackupDirty.has(backupKey)
        const backupPointA = backupDirty
          ? pointBackups[backupKey]?.a ?? pointScores?.scoreA ?? '0'
          : pointScores?.scoreA ?? '0'
        const backupPointB = backupDirty
          ? pointBackups[backupKey]?.b ?? pointScores?.scoreB ?? '0'
          : pointScores?.scoreB ?? '0'

        const gestureCameraCtx = () => {
          const courtSetupKey = friendly
            ? sessionId
              ? friendlyGestureCourtSetupKey(sessionId, game.gameNumber, row.courtLabel)
              : null
            : competitionId && courtId
              ? competitionCourtSetupKey(competitionId, game.gameNumber, courtId)
              : null
          if (!courtSetupKey) return null
          return {
            courtSetupKey,
            friendly,
            friendlySessionId: friendly ? sessionId : undefined,
            competitionId: friendly ? undefined : competitionId,
            gameNumber: game.gameNumber,
            courtId: friendly ? row.courtLabel : courtId!,
            courtLabel: row.courtLabel,
            roundId: gameRoundId,
            playTo: courtScoreMax,
            scoreUnit,
            roster: rosterFromCourt(teamAPlayers, teamBPlayers),
            ourTeam: 'a' as const,
          }
        }

        const commitGestureGamesSync = (gamesA: string, gamesB: string) => {
          if (!gestureScoring) return
          const baseCtx = gestureCameraCtx()
          if (!baseCtx) return
          void (async () => {
            let ctx = baseCtx
            if (!ctx.friendly && !ctx.roundId && resolveCompetitionRoundId) {
              const resolvedRoundId = await resolveCompetitionRoundId(game.gameNumber)
              if (resolvedRoundId) ctx = { ...ctx, roundId: resolvedRoundId }
            }
            const { error, log, saved } = await syncGestureCameraGamesOverride(
              ctx,
              Number(gamesA) || 0,
              Number(gamesB) || 0,
            )
            if (error) return
            if (log) onGestureGamesSynced?.(log)
            if (saved) {
              gamesDraftRef.current.delete(gamesDraftKey)
              gamesDirtyRef.current.delete(gamesDraftKey)
            }
          })()
        }

        const commitGamesScore = () => {
          const draftKey = gamesDraftKey
          if (!gamesDirtyRef.current.has(draftKey)) return
          const stored = gamesDraftRef.current.get(draftKey)
          const gamesA = stored?.a ?? scoreA ?? '0'
          const gamesB = stored?.b ?? scoreB ?? '0'
          // #region agent log
          agentDebugIngest(
            'LB',
            `① games updated ${row.courtLabel} — teamA=${gamesA} teamB=${gamesB}`,
            {
              courtLabel: row.courtLabel,
              teamA: teamA.join(' / '),
              teamB: teamB.join(' / '),
              courtId,
              gameNumber: game.gameNumber,
            },
            'LB',
            '5d6061',
          )
          // #endregion
          if (!friendly && onCompetitionCourtGamesSaved && courtId) {
            void onCompetitionCourtGamesSaved(
              game.gameNumber,
              courtId,
              Number(gamesA) || 0,
              Number(gamesB) || 0,
              row.courtLabel,
            )
              .then(() => {
                gamesDirtyRef.current.delete(draftKey)
                gamesDraftRef.current.delete(draftKey)
              })
              .catch((err: unknown) => {
                // #region agent log
                agentDebugIngest(
                  'LB',
                  `① save failed — ${err instanceof Error ? err.message : String(err)}`,
                  { courtLabel: row.courtLabel, courtId },
                  'LB',
                  '5d6061',
                )
                // #endregion
              })
          }
          if (gestureScoring) {
            commitGestureGamesSync(gamesA, gamesB)
          } else if (submitCourt && row.courtKey) {
            void submitCourt(row.courtKey).then(() => {
              gamesDirtyRef.current.delete(draftKey)
              gamesDraftRef.current.delete(draftKey)
            })
          }
        }

        const scheduleGesturePointsSync = (pointsA: string, pointsB: string) => {
          if (!gestureScoring) return
          const parsedA = parseTennisPointInput(pointsA)
          const parsedB = parseTennisPointInput(pointsB)
          if (parsedA == null || parsedB == null) return
          const ctx = gestureCameraCtx()
          if (!ctx) return

          const syncKey = `pts:${row.courtKey ?? ctx.courtSetupKey}`
          const timers = pointsSyncTimers.current
          const prior = timers.get(syncKey)
          if (prior) clearTimeout(prior)

          timers.set(
            syncKey,
            setTimeout(() => {
              timers.delete(syncKey)
              void syncGestureCameraPointsOverride(ctx, parsedA, parsedB).then(() => {
                setPointBackupDirty((prev) => {
                  const next = new Set(prev)
                  next.delete(backupKey)
                  return next
                })
              })
            }, 450),
          )
        }

        const onGamesA = (value: string) => {
          gamesDirtyRef.current.add(gamesDraftKey)
          if (row.courtKey) setDraft(row.courtKey, 'teamA', value)
          const cur = gamesDraftRef.current.get(gamesDraftKey) ?? { a: scoreA ?? '0', b: scoreB ?? '0' }
          gamesDraftRef.current.set(gamesDraftKey, { ...cur, a: value })
        }
        const onGamesB = (value: string) => {
          gamesDirtyRef.current.add(gamesDraftKey)
          if (row.courtKey) setDraft(row.courtKey, 'teamB', value)
          const cur = gamesDraftRef.current.get(gamesDraftKey) ?? { a: scoreA ?? '0', b: scoreB ?? '0' }
          gamesDraftRef.current.set(gamesDraftKey, { ...cur, b: value })
        }

        const onBackupPointA = (value: string) => {
          setPointBackupDirty((prev) => new Set(prev).add(backupKey))
          setPointBackups((prev) => ({
            ...prev,
            [backupKey]: { a: value, b: prev[backupKey]?.b ?? backupPointB },
          }))
          scheduleGesturePointsSync(value, backupPointB)
        }
        const onBackupPointB = (value: string) => {
          setPointBackupDirty((prev) => new Set(prev).add(backupKey))
          setPointBackups((prev) => ({
            ...prev,
            [backupKey]: { a: prev[backupKey]?.a ?? backupPointA, b: value },
          }))
          scheduleGesturePointsSync(backupPointA, value)
        }

        return (
          <CourtCard
            key={row.courtLabel}
            courtLabel={row.courtLabel}
            court={liveCourt ?? court}
            finished={courtFinished}
            href={href}
            gestureScoreHref={undefined}
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
              onScoreA={gamesEditable ? onGamesA : undefined}
              onScoreB={gamesEditable ? onGamesB : undefined}
              onGamesCommit={gamesEditable ? commitGamesScore : undefined}
              scoreMax={courtScoreMax}
              disabled={!gamesEditable}
              livePointScores={
                showGesturePoints ? (pointScores ?? { scoreA: '0', scoreB: '0' }) : undefined
              }
              backupPointA={showGesturePoints ? backupPointA : undefined}
              backupPointB={showGesturePoints ? backupPointB : undefined}
              onBackupPointA={gamesEditable ? onBackupPointA : undefined}
              onBackupPointB={gamesEditable ? onBackupPointB : undefined}
              finished={courtFinished}
              embedded
              compact={compact}
              scoreFirst={scoreFirst}
              showScores={hasCourtScores}
              colorNamesByGender={Boolean(duoTeamLabels)}
              t={t}
            />
          </CourtCard>
        )
      })}
    </div>
  )
}
