import type { CompetitionPlayer, CompetitionSessionPair } from '../hooks/useCompetitions'
import {
  competitionSqlSchedule,
  fitCompetitionScheduleToSession,
  mergeScheduleIntoScoringConfig,
} from './competitionLayout'
import { ensureCompetitionScheduleSaved } from './persistCompetitionSchedule'
import { supabase } from './supabaseClient'
import type { GameSession } from './types'
import { agentDebugIngest } from './debug/devDebug'

type PublicRound = { id: string; round_number: number }

/** Fetch round UUID for a game when client rounds state is empty or stale. */
export async function fetchCompetitionRoundId(
  sessionId: string,
  gameNumber: number,
): Promise<string | undefined> {
  const { data, error } = await supabase.rpc('get_public_competition', {
    p_session_id: sessionId,
  })
  if (error || !data) return undefined
  const rounds = ((data as { rounds?: PublicRound[] }).rounds ?? []) as PublicRound[]
  return rounds.find((round) => round.round_number === gameNumber)?.id
}

export type EnsureCompetitionRoundResult = {
  roundId?: string
  started?: boolean
  error?: string
}

function mergeCompetitionSession(
  fallback: GameSession,
  live: GameSession | undefined,
): GameSession {
  if (!live) return fallback
  return {
    ...fallback,
    ...live,
    starts_at: live.starts_at ?? fallback.starts_at,
    ends_at: live.ends_at ?? fallback.ends_at,
    scoring_config: live.scoring_config ?? fallback.scoring_config,
    partnership_mode: live.partnership_mode ?? fallback.partnership_mode,
    rules: live.rules ?? fallback.rules,
  }
}

async function saveFittedSchedule(
  sessionId: string,
  session: GameSession,
  fitted: ReturnType<typeof fitCompetitionScheduleToSession>,
): Promise<{ session: GameSession; error?: string }> {
  let nextConfig = mergeScheduleIntoScoringConfig(session.scoring_config, {
    games: fitted.totalGames,
    gameMinutes: fitted.gameMinutes,
    breakMinutes: fitted.breakMinutes,
  })
  if (fitted.gameCountChanged) {
    const { schedule: _removed, schedule_version: _ver, ...rest } = nextConfig
    nextConfig = rest
  }
  const { error: cfgErr } = await supabase.rpc('save_competition_scoring_config', {
    p_session_id: sessionId,
    p_scoring_config: nextConfig,
  })
  if (cfgErr) return { session, error: cfgErr.message }
  return { session: { ...session, scoring_config: nextConfig } }
}

/** Resolve round id; start competition when still open and rounds missing. */
export async function ensureCompetitionRoundId(
  sessionId: string,
  gameNumber: number,
  opts: {
    session: GameSession
    roster: CompetitionPlayer[]
    sessionPairs?: CompetitionSessionPair[]
  },
): Promise<EnsureCompetitionRoundResult> {
  let roundId = await fetchCompetitionRoundId(sessionId, gameNumber)
  if (roundId) return { roundId }

  const { data, error } = await supabase.rpc('get_public_competition', {
    p_session_id: sessionId,
  })
  if (error || !data) {
    return { error: error?.message ?? 'competition not found' }
  }

  const payload = data as { session?: GameSession; rounds?: PublicRound[] }
  const mergedSession = mergeCompetitionSession(opts.session, payload.session)
  const apiRounds = payload.rounds ?? []
  roundId = apiRounds.find((round) => round.round_number === gameNumber)?.id
  if (roundId) return { roundId }

  if (mergedSession.status !== 'open') {
    // #region agent log
    agentDebugIngest(
      'LB',
      `② round failed — status=${mergedSession.status}`,
      { gameNumber, apiRoundsLen: apiRounds.length },
      'LB',
      '5d6061',
    )
    // #endregion
    return { error: 'Competition rounds not ready' }
  }

  const beforeSql = competitionSqlSchedule(mergedSession)
  // #region agent log
  agentDebugIngest(
    'LB',
    '② schedule check',
    {
      gameNumber,
      durationMin: beforeSql.durationMinutes,
      usedMin: beforeSql.usedMinutes,
      fits: beforeSql.fits,
      games: beforeSql.totalGames,
      gameMin: beforeSql.gameMinutes,
      breakMin: beforeSql.breakMinutes,
    },
    'LB',
    '5d6061',
  )
  // #endregion

  let sessionForStart = mergedSession
  if (!beforeSql.fits) {
    const fitted = fitCompetitionScheduleToSession(mergedSession)
    if (!fitted.fits) {
      // #region agent log
      agentDebugIngest(
        'LB',
        '② round failed — schedule cannot fit window',
        {
          gameNumber,
          durationMin: fitted.durationMinutes,
          usedMin: fitted.usedMinutes,
        },
        'LB',
        '5d6061',
      )
      // #endregion
      return { error: 'Schedule exceeds session time' }
    }
    const saved = await saveFittedSchedule(sessionId, mergedSession, fitted)
    if (saved.error) return { error: saved.error }
    sessionForStart = saved.session
    // #region agent log
    agentDebugIngest(
      'LB',
      `② schedule fitted → ${fitted.totalGames}×${fitted.gameMinutes}min`,
      {
        gameNumber,
        durationMin: fitted.durationMinutes,
        usedMin: fitted.usedMinutes,
        gameCountChanged: fitted.gameCountChanged,
      },
      'LB',
      '5d6061',
    )
    // #endregion
  }

  const scheduleErr = await ensureCompetitionScheduleSaved(
    sessionId,
    sessionForStart,
    opts.roster,
    opts.sessionPairs ?? [],
  )
  if (scheduleErr) return { error: scheduleErr }

  let { error: startErr } = await supabase.rpc('start_competition', {
    p_session_id: sessionId,
  })

  if (startErr?.message?.includes('Schedule exceeds session time')) {
    const retryFit = fitCompetitionScheduleToSession(sessionForStart)
    if (retryFit.fits) {
      const saved = await saveFittedSchedule(sessionId, sessionForStart, retryFit)
      if (!saved.error) {
        sessionForStart = saved.session
        // #region agent log
        agentDebugIngest(
          'LB',
          `② schedule retry → ${retryFit.totalGames}×${retryFit.gameMinutes}min`,
          { gameNumber, usedMin: retryFit.usedMinutes },
          'LB',
          '5d6061',
        )
        // #endregion
        ;({ error: startErr } = await supabase.rpc('start_competition', {
          p_session_id: sessionId,
        }))
      }
    }
  }

  if (startErr) {
    // #region agent log
    agentDebugIngest(
      'LB',
      `② round failed — ${startErr.message}`,
      { gameNumber },
      'LB',
      '5d6061',
    )
    // #endregion
    return { error: startErr.message }
  }

  roundId = await fetchCompetitionRoundId(sessionId, gameNumber)
  // #region agent log
  agentDebugIngest(
    'LB',
    `② round ready ${roundId ?? 'missing'}`,
    { gameNumber, started: true },
    'LB',
    '5d6061',
  )
  // #endregion
  if (!roundId) return { error: 'Round not found after start' }
  return { roundId, started: true }
}
