import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CourtMatchCell, ScoreStepper } from '../components/gameCard/CourtCard'
import { useAuth } from '../hooks/useAuth'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { useMatchGestureLog } from '../hooks/useMatchGestureLog'
import { useSetupCourts } from '../hooks/useSetupCourts'
import { useTranslation } from '../hooks/useTranslation'
import { breakMinutesFromConfig } from '../lib/competitionLayout'
import { pivotScheduleByCourt, pivotScheduleByGame } from '../lib/competitionCourtBoard'
import {
  courtGameScoreMax,
  courtSubmitReady,
  scoreFieldSubmitValue,
} from '../lib/competitionScoreInput'
import { americanoScoringUnit } from '../lib/competitionPresets'
import { displayCourtLabel } from '../lib/courtDisplay'
import { friendlyCourtSetupKey } from '../lib/friendlyCourtLive'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyScheduleLive,
  friendlyStartsAtIso,
} from '../lib/friendlyGames'
import { saveFriendlyManualCourtScore } from '../lib/friendlyManualScore'
import { liveCourtGamesScore } from '../lib/liveCourtScore'
import { formatDateInput } from '../lib/courtSchedule'

export function ManualScoreCourtPage() {
  const { id, gameNumber, courtSlug } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const gameNum = Number(gameNumber)
  const courtLabel = courtSlug ? decodeURIComponent(courtSlug) : ''
  const { game, loading: gameLoading } = useFriendlyGame(id)
  const { courtNames } = useSetupCourts()
  const courtSetupKey =
    id && courtLabel && Number.isFinite(gameNum)
      ? friendlyCourtSetupKey(id, gameNum, courtLabel)
      : undefined
  const { log, loading: logLoading } = useMatchGestureLog(courtSetupKey)

  const courtMatch = useMemo(() => {
    if (!game || !courtLabel || !Number.isFinite(gameNum)) return null
    const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
    const organizedConfig = {
      ...DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
      ...config,
      day: config.day || formatDateInput(new Date()),
    }
    const previewGames = friendlyPreviewGames(game, courtNames, game.profileAvatars)
    const session = friendlyOrganizedSession(organizedConfig)
    const startsAtIso = friendlyStartsAtIso(organizedConfig)
    const breakMinutes = breakMinutesFromConfig(session.scoring_config)
    const columns = pivotScheduleByCourt(
      previewGames,
      startsAtIso,
      organizedConfig.gameMinutes,
      breakMinutes,
    )
    const games = pivotScheduleByGame(columns)
    const scheduleGame = games.find((g) => g.gameNumber === gameNum)
    return scheduleGame?.courts.find((c) => c.courtLabel === courtLabel) ?? null
  }, [courtLabel, courtNames, game, gameNum])

  const scoreUnit = useMemo(
    () =>
      game
        ? americanoScoringUnit(
            friendlyOrganizedSession(game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG),
          )
        : 'games',
    [game],
  )
  const scoreMax = courtGameScoreMax()

  const savedScore = useMemo(() => {
    if (!log) return { scoreA: '', scoreB: '' }
    return liveCourtGamesScore(log, scoreUnit) ?? { scoreA: '', scoreB: '' }
  }, [log, scoreUnit])

  const [teamAStr, setTeamAStr] = useState('')
  const [teamBStr, setTeamBStr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (logLoading) return
    setTeamAStr(savedScore.scoreA)
    setTeamBStr(savedScore.scoreB)
  }, [logLoading, savedScore.scoreA, savedScore.scoreB])

  const canSubmit = courtSubmitReady(teamAStr, teamBStr)
  const scheduleLive = game
    ? friendlyScheduleLive(game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG)
    : false

  if (authLoading || gameLoading || logLoading) {
    return <p className="p-4 text-center text-sm text-brand-muted">{t('common.loading')}</p>
  }
  if (!user || !game || !courtMatch || !id || !courtLabel || !Number.isFinite(gameNum)) {
    return <Navigate to="/friendly" replace />
  }
  if (!scheduleLive) {
    return <Navigate to={`/friendly/${game.id}`} replace />
  }

  const backTo = `/friendly/${game.id}`
  const label = displayCourtLabel(courtLabel, t)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const { error: saveError } = await saveFriendlyManualCourtScore(
      game.id,
      {
        gameNumber: gameNum,
        courtLabel,
        teamA: scoreFieldSubmitValue(teamAStr),
        teamB: scoreFieldSubmitValue(teamBStr),
        teamAPlayers: courtMatch.teamAPlayers,
        teamBPlayers: courtMatch.teamBPlayers,
      },
      scoreUnit,
    )
    setBusy(false)
    if (saveError) {
      setError(saveError)
      return
    }
    navigate(backTo)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-brand-bg">
      <header className="flex shrink-0 items-center gap-2 border-b border-brand-border/60 px-3 py-2">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          aria-label={t('common.back')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-accent/40 bg-brand-bg-alt text-brand-accent shadow-sm transition active:scale-95 dark:border-brand-accent/35 dark:bg-white/10 dark:text-brand-accent-light"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center font-display text-lg font-bold text-brand-accent">
          {label}
        </h1>
        <span className="w-8 shrink-0" aria-hidden />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <CourtMatchCell
          teamA={courtMatch.teamA}
          teamB={courtMatch.teamB}
          teamAPlayers={courtMatch.teamAPlayers}
          teamBPlayers={courtMatch.teamBPlayers}
          scoreUnit={scoreUnit}
          disabled
          embedded
          t={t}
        />

        <div className="flex items-center justify-center gap-6 rounded-xl border border-brand-border/60 bg-brand-surface p-4 dark:border-white/15 dark:bg-white/[0.05]">
          <ScoreStepper
            value={teamAStr}
            onChange={setTeamAStr}
            ariaLabel={t('aria.teamAScore', { unit: scoreUnit })}
            scoreMax={scoreMax}
            tv
          />
          <span className="text-sm font-semibold text-brand-muted">vs</span>
          <ScoreStepper
            value={teamBStr}
            onChange={setTeamBStr}
            ariaLabel={t('aria.teamBScore', { unit: scoreUnit })}
            scoreMax={scoreMax}
            tv
          />
        </div>

        <button
          type="button"
          disabled={busy || !canSubmit}
          onClick={() => void handleSubmit()}
          className="brand-btn w-full py-3 text-sm font-semibold disabled:opacity-40"
        >
          {busy ? t('common.loading') : t('common.submit')}
        </button>
        {error ? <p className="text-center text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  )
}
