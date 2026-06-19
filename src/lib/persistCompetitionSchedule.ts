import { buildDuoStoredSchedule } from './duoRoundRobinSchedule'
import { DUO_GAME_COUNT, teamsFromConfig, isDuoCompetition } from './competitionFormatPresets'
import { americanoScheduleFromSession } from './competitionLayout'
import {
  mergeScheduleIntoScoringConfig,
  scoringConfigHasCanonicalSchedule,
} from './competitionScheduleLayout'
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

export async function saveCompetitionTeamLabel(
  sessionId: string,
  scoringConfig: ScoringConfig | null | undefined,
  teamIndex: number,
  pairId: string | null | undefined,
  label: string,
): Promise<string | null> {
  const trimmed = label.trim() || `Team ${teamIndex + 1}`

  if (pairId) {
    const { error } = await supabase
      .from('session_pairs')
      .update({ pair_label: trimmed })
      .eq('id', pairId)
    if (error) return error.message
  }

  const teams = teamsFromConfig(scoringConfig)
  if (teamIndex < teams.length) {
    const nextTeams = teams.map((team, index) =>
      index === teamIndex ? { ...team, label: trimmed } : team,
    )
    const { error } = await supabase.rpc('save_competition_scoring_config', {
      p_session_id: sessionId,
      p_scoring_config: { ...(scoringConfig ?? {}), teams: nextTeams },
    })
    if (error) return error.message
  }

  return null
}

export async function saveScheduleForSession(
  sessionId: string,
  baseConfig: ScoringConfig,
  schedule: ReturnType<typeof buildStoredSchedule>,
  previewSeed: number,
): Promise<string | null> {
  const nextConfig = mergeScheduleIntoScoringConfig({
    ...baseConfig,
    schedule_seed: previewSeed,
    schedule_version: RANKED_SCHEDULE_VERSION,
    schedule,
  })
  const { error: cfgErr } = await supabase.rpc('save_competition_scoring_config', {
    p_session_id: sessionId,
    p_scoring_config: nextConfig,
  })
  return cfgErr?.message ?? null
}

/** Align stored scoring_config with the canonical schedule layout (for play SQL). */
export async function ensureScoringConfigScheduleSynced(
  sessionId: string,
  session: Pick<GameSession, 'scoring_config'>,
): Promise<string | null> {
  if (scoringConfigHasCanonicalSchedule(session.scoring_config)) return null
  const { error } = await supabase.rpc('save_competition_scoring_config', {
    p_session_id: sessionId,
    p_scoring_config: mergeScheduleIntoScoringConfig(session.scoring_config),
  })
  return error?.message ?? null
}

/** Write stored match-ups when missing so start_competition can assign courts. */
export async function ensureCompetitionScheduleSaved(
  sessionId: string,
  session: GameSession,
  roster: CompetitionPlayer[],
): Promise<string | null> {
  const syncErr = await ensureScoringConfigScheduleSynced(sessionId, session)
  if (syncErr) return syncErr

  const stored = storedScheduleFromConfig(session.scoring_config)
  if (stored.length > 0) return null

  const seed = scheduleSeedFromSession(session.scoring_config)
  const ranked = sortRosterByRank(roster)
  const { totalGames } = americanoScheduleFromSession(session)
  const baseConfig = mergeScheduleIntoScoringConfig(session.scoring_config ?? {})
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
