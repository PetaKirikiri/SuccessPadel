import { buildDuoStoredSchedule } from './duoRoundRobinSchedule'
import { DUO_GAME_COUNT, teamsFromConfig, isDuoCompetition } from './competitionFormatPresets'
import { americanoScheduleFromSession } from './competitionLayout'
import { solveBalancedSchedule } from './balancedSchedule'
import type { CompetitionPlayer } from '../hooks/useCompetitions'
import {
  buildStoredSchedule,
  padRosterToTarget,
  RANKED_SCHEDULE_VERSION,
  scheduleSeedFromSession,
  sortRosterByRank,
  storedScheduleFromConfig,
  targetPlayerCount,
} from './rankedSchedule'
import { supabase } from './supabaseClient'
import type { GameSession, ScoringConfig } from './types'

export async function saveScheduleForSession(
  sessionId: string,
  baseConfig: ScoringConfig,
  schedule: ReturnType<typeof buildStoredSchedule>,
  previewSeed: number,
): Promise<string | null> {
  const nextConfig = {
    ...baseConfig,
    schedule_seed: previewSeed,
    schedule_version: RANKED_SCHEDULE_VERSION,
    schedule,
  }
  const { error: cfgErr } = await supabase.rpc('save_competition_scoring_config', {
    p_session_id: sessionId,
    p_scoring_config: nextConfig,
  })
  return cfgErr?.message ?? null
}

/** Write stored match-ups when missing so start_competition can assign courts. */
export async function ensureCompetitionScheduleSaved(
  sessionId: string,
  session: GameSession,
  roster: CompetitionPlayer[],
): Promise<string | null> {
  const stored = storedScheduleFromConfig(session.scoring_config)
  if (stored.length > 0) return null

  const seed = scheduleSeedFromSession(session.scoring_config)
  const ranked = sortRosterByRank(roster)
  const { totalGames } = americanoScheduleFromSession(session)
  const baseConfig = (session.scoring_config ?? {}) as ScoringConfig
  const isDuo = isDuoCompetition(session)
  const slotCount = targetPlayerCount(session, ranked.length, isDuo)

  if (slotCount < 4 || slotCount % 4 !== 0) {
    return null
  }

  let schedule: ReturnType<typeof buildStoredSchedule> = []
  if (isDuo) {
    const teams = teamsFromConfig(session.scoring_config)
    if (teams.length < 2) return null
    schedule = buildDuoStoredSchedule(
      teams.map((t) => ({ label: t.label, rosterIds: t.roster_ids })),
      totalGames || DUO_GAME_COUNT,
      seed,
    )
  } else {
    const padded = padRosterToTarget(ranked, slotCount)
    schedule = buildStoredSchedule(
      padded,
      solveBalancedSchedule(slotCount, totalGames, seed),
    )
  }

  return saveScheduleForSession(sessionId, baseConfig, schedule, seed)
}
