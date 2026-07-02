import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TranslateFn } from '../../i18n'
import {
  courtSubmitReady,
  effectiveScoreField,
  scoreDigitsOnly,
  scoreFieldSubmitValue,
} from '../../lib/competitionScoreInput'
import type { CourtScoreSubmit } from '../../lib/competitionScoreInput'
import { liveCourtScoreKey, type LiveCourtGamesScore } from '../../lib/liveCourtScore'
import type { FriendlyCourtScoreSubmit } from '../../lib/friendlyManualScore'
import type { LiveCourt } from './gameBoardTypes'
import { courtIdForLabel } from './courtIdForLabel'
import type { GameCardCourtRow, GameCardSession, MatchForCourt, ScoringGame } from './types'

type CourtDraft = { teamA: string; teamB: string }

const noopMatchForCourt: MatchForCourt = () => undefined

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
  return {
    teamA: current?.teamA ?? '',
    teamB: current?.teamB ?? '',
    [side]: scoreDigitsOnly(value),
  }
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
  const [error, setError] = useState<{ courtKey: string; message: string } | null>(null)

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

  const setDraft = useCallback((courtKey: string, side: 'teamA' | 'teamB', value: string) => {
    setDirtyCourts((prev) => new Set(prev).add(courtKey))
    setDrafts((prev) => ({
      ...prev,
      [courtKey]: nextCourtDraft(prev[courtKey], side, value),
    }))
  }, [])

  const courtScoreRows: GameCardCourtRow[] = useMemo(() => {
    return scoringCourts.map(({ courtId, courtLabel }) => {
      const draft = drafts[courtId]
      const saved = gameRoundId ? matchForCourt(gameRoundId, courtId) : undefined
      const isDirty = dirtyCourts.has(courtId)
      const { teamAStr, teamBStr } = scoreStringsForCourt(draft, saved, isDirty)
      const court = game.courts.find((c) => c.courtLabel === courtLabel)
      if (!court) {
        return {
          courtKey: courtId,
          courtId,
          courtLabel,
          court: game.courts[0],
          teamAStr,
          teamBStr,
          canSubmit: false,
        }
      }
      return {
        courtKey: courtId,
        courtId,
        courtLabel,
        court,
        teamAStr,
        teamBStr,
        canSubmit: courtSubmitReady(teamAStr, teamBStr, playTo),
      }
    })
  }, [dirtyCourts, drafts, game.courts, gameRoundId, matchForCourt, playTo, scoringCourts])

  const submitCourt = async (courtKey: string) => {
    const row = courtScoreRows.find((r) => r.courtKey === courtKey)
    if (!onSubmitScores || !gameRoundId || !row?.courtId || !row.canSubmit) return
    const teamA = scoreFieldSubmitValue(row.teamAStr)
    const teamB = scoreFieldSubmitValue(row.teamBStr)
    setBusyCourtKey(courtKey)
    setError(null)
    try {
      await onSubmitScores([
        { roundId: gameRoundId, courtId: row.courtId, teamA, teamB },
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

  return { courtScoreRows, setDraft, submitCourt, busyCourtKey, error, canEdit, hasScoring: true }
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

  const courtScoreRows: GameCardCourtRow[] = useMemo(() => {
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
      return {
        courtKey,
        courtLabel,
        court,
        teamAStr,
        teamBStr,
        canSubmit: courtSubmitReady(teamAStr, teamBStr, playTo),
      }
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

  return { courtScoreRows, setDraft, submitCourt, busyCourtKey, error, canEdit, hasScoring: true }
}

export function useGameCardScoring({
  game,
  session,
  courtsForGame,
  courtIdByLabel,
  gameRoundId,
  liveCourtScores,
  canEdit,
  courtPlayTo,
  onSaved,
  t,
}: {
  game: ScoringGame
  session: GameCardSession
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  gameRoundId?: string
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  canEdit?: boolean
  courtPlayTo?: number
  onSaved?: () => void | Promise<void>
  t: TranslateFn
}) {
  const previewRows: GameCardCourtRow[] = useMemo(
    () =>
      game.courts.map((court) => ({
        courtKey: liveCourtScoreKey(game.gameNumber, court.courtLabel),
        courtLabel: court.courtLabel,
        court,
        teamAStr: '',
        teamBStr: '',
        canSubmit: false,
      })),
    [game.courts, game.gameNumber],
  )

  const competitionScoring = useGameScoring({
    game,
    gameRoundId,
    courtsForGame,
    courtIdByLabel,
    matchForCourt:
      session.kind === 'competition' && session.matchForCourt
        ? session.matchForCourt
        : noopMatchForCourt,
    canEdit: session.kind === 'competition' ? Boolean(canEdit) : false,
    onSubmitScores: session.kind === 'competition' ? session.onSubmitScores : undefined,
    onSaved,
    playTo: courtPlayTo,
    t,
  })

  const friendlyScoring = useFriendlyManualScoring({
    game,
    liveCourtScores,
    canEdit: session.kind === 'friendly' ? Boolean(canEdit) : false,
    onSubmit: session.kind === 'friendly' ? session.onSubmitScores : undefined,
    onSaved,
    playTo: courtPlayTo,
    t,
  })

  if (session.kind === 'friendly' && session.scoringEnabled) {
    const canSubmitScores = Boolean(session.onSubmitScores && session.scoreSubmitEnabled !== false)
    return { ...friendlyScoring, canSubmitScores, hasScoring: true }
  }

  if (session.kind === 'competition' && session.scoringEnabled && session.matchForCourt) {
    return { ...competitionScoring, canSubmitScores: Boolean(session.onSubmitScores), hasScoring: true }
  }

  return {
    courtScoreRows: previewRows,
    setDraft: () => {},
    submitCourt: async () => {},
    busyCourtKey: null as string | null,
    error: null as { courtKey: string; message: string } | null,
    canEdit: false,
    canSubmitScores: false,
    hasScoring: false,
  }
}
