import type { CompetitionPlayer, CompetitionSessionPair } from '../hooks/useCompetitions'
import { resolveCompetitionSchedule } from './competitionLayout'
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

  const schedule = resolveCompetitionSchedule(mergedSession)
  // #region agent log
  agentDebugIngest(
    'LB',
    '② schedule check',
    {
      gameNumber,
      durationMin: schedule.eventMinutes,
      usedMin: schedule.usedMinutes,
      fits: schedule.fits,
      games: schedule.totalGames,
      gameMin: schedule.gameMinutes,
      breakMin: schedule.breakMinutes,
    },
    'LB',
    '5d6061',
  )
  // #endregion

  if (!schedule.fits) {
    return { error: 'Schedule exceeds session time. Update it in competition setup.' }
  }

  const scheduleErr = await ensureCompetitionScheduleSaved(
    sessionId,
    mergedSession,
    opts.roster,
    opts.sessionPairs ?? [],
  )
  if (scheduleErr) return { error: scheduleErr }

  const { error: startErr } = await supabase.rpc('start_competition', {
    p_session_id: sessionId,
  })

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
