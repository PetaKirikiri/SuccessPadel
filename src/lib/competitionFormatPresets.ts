import {
  buildAmericanoScoringConfig,
  buildRulesText,
  ruleFormatLabel,
  rulesToPartnershipMode,
  type Gender,
  type SkillLevel,
} from './competitionPresets'
import { DEFAULT_COMPETITION_EVENT_MINUTES } from './competitionScheduleConstants'
import {
  courtCountFromPlayers,
  playersFromCourtCount,
  teamsFromCourtCount,
} from './competitionLayout'
import {
  COMPETITION_SCHEDULE,
  type CompetitionScheduleValues,
  mergeScheduleIntoScoringConfig,
} from './competitionScheduleLayout'
import { OPEN_SLOT_NAME } from './rankedSchedule'
import { orderSessionPairsByTeamIndex } from './competitionDuoTeams'
import type { TranslateFn } from '../i18n'
import type { RuleChip } from './friendlyGameDisplay'
import type { GameSession, ScoringConfig } from './types'

export type CompetitionPlayerMode = 'singles' | 'duos'

export type CompetitionTeamConfig = {
  label: string
  roster_ids: [string, string]
}

export const DUO_TEAM_COUNT = 6
export const DUO_PLAYER_COUNT = 12
export const DUO_COURT_COUNT = 3
export const DUO_GAME_COUNT = COMPETITION_SCHEDULE.games
export const DUO_GAME_MINUTES = COMPETITION_SCHEDULE.gameMinutes
export const DUO_BREAK_MINUTES = COMPETITION_SCHEDULE.breakMinutes
export const DUO_LEAGUE_WEEKS = 6

export const SINGLES_COMPETITION = {
  playerMode: 'singles' as const,
  targetPlayers: 16 as const,
  gameCount: COMPETITION_SCHEDULE.games,
  americanoTarget: 6 as const,
  breakMinutes: COMPETITION_SCHEDULE.breakMinutes,
  gameMinutes: COMPETITION_SCHEDULE.gameMinutes,
} as const

export const DUO_COMPETITION = {
  playerMode: 'duos' as const,
  targetPlayers: DUO_PLAYER_COUNT,
  teamCount: DUO_TEAM_COUNT,
  gameCount: COMPETITION_SCHEDULE.games,
  americanoTarget: 6 as const,
  breakMinutes: COMPETITION_SCHEDULE.breakMinutes,
  gameMinutes: COMPETITION_SCHEDULE.gameMinutes,
} as const

export function competitionPlayerMode(
  config: ScoringConfig | null | undefined,
): CompetitionPlayerMode {
  if (config?.competition_player_mode === 'duos') return 'duos'
  return 'singles'
}

export function isDuoCompetition(
  session: Pick<GameSession, 'scoring_config' | 'partnership_mode'> | null | undefined,
): boolean {
  if (!session) return false
  return competitionPlayerMode(session.scoring_config) === 'duos'
}

/** Americano-style per-game scoring (singles rotation or fixed duos). */
export function usesCompetitionGameScoring(
  session: Pick<GameSession, 'partnership_mode' | 'rules' | 'scoring_config'> | null | undefined,
): boolean {
  if (!session) return false
  if (isDuoCompetition(session)) return true
  if (session.partnership_mode === 'americano') return true
  return /americano/i.test(session.rules ?? '')
}

export function competitionFormatPreset(mode: CompetitionPlayerMode) {
  return mode === 'duos' ? DUO_COMPETITION : SINGLES_COMPETITION
}

export function presetRuleChips(
  mode: CompetitionPlayerMode,
  t: TranslateFn,
  opts?: { courtCount?: number; schedule?: CompetitionScheduleValues },
): RuleChip[] {
  const preset = competitionFormatPreset(mode)
  const schedule = opts?.schedule ?? COMPETITION_SCHEDULE
  const { games: gameCount, gameMinutes, breakMinutes } = schedule
  const courts = opts?.courtCount
  const formatLabel =
    mode === 'duos' ? t('competition.formatDuos') : ruleFormatLabel('americano')
  const chips: RuleChip[] = [
    {
      key: 'format',
      label: formatLabel,
      hintKey: mode === 'duos' ? 'competition.hintDuosFormat' : 'friendly.hint.format',
      icon: mode === 'duos' ? 'rounds' : 'americano',
    },
  ]
  if (courts != null) {
    const players = playersFromCourtCount(courts)
    chips.push({
      key: 'courts',
      label: t('competition.chipCourts', { n: courts }),
      hintKey:
        mode === 'duos' ? 'competition.courtsTeamsPlayers' : 'competition.courtsPlayers',
      hintParams:
        mode === 'duos'
          ? { courts, teams: teamsFromCourtCount(courts), players }
          : { courts, players },
      icon: 'rounds',
    })
  }
  chips.push(
    {
      key: 'scoring',
      label: t('friendly.chip.firstToPoints', { n: preset.americanoTarget }),
      hintKey: 'friendly.hint.scoringFirstToPoints',
      hintParams: { n: preset.americanoTarget },
      icon: 'scoring',
    },
    {
      key: 'rounds',
      label: t('friendly.chip.matches', { n: gameCount }),
      hintKey: 'friendly.hint.rounds',
      icon: 'rounds',
    },
    {
      key: 'gameMin',
      label: t('friendly.chip.minsPerGame', { n: gameMinutes }),
      hintKey: 'friendly.hint.gameMinutes',
      icon: 'game-minutes',
    },
    {
      key: 'break',
      label: t('friendly.chip.minBreaks', { n: breakMinutes }),
      hintKey: 'friendly.hint.break',
      icon: 'break',
    },
  )
  return chips
}

export function fittedAmericanoSchedule(
  _mode: CompetitionPlayerMode,
  gameCount?: number,
  eventMinutes = DEFAULT_COMPETITION_EVENT_MINUTES,
) {
  const games = gameCount ?? COMPETITION_SCHEDULE.games
  return {
    games,
    gameMinutes: COMPETITION_SCHEDULE.gameMinutes,
    breakMinutes: COMPETITION_SCHEDULE.breakMinutes,
    eventMinutes,
  }
}

export function competitionEventMinutes(
  schedule: CompetitionScheduleValues = COMPETITION_SCHEDULE,
): number {
  return (
    schedule.games * schedule.gameMinutes +
    Math.max(0, schedule.games - 1) * schedule.breakMinutes
  )
}

export function competitionScoringConfig(
  mode: CompetitionPlayerMode,
  extra?: {
    teams?: CompetitionTeamConfig[]
    leagueId?: string
    leagueWeek?: number
    schedule?: CompetitionScheduleValues
  },
): ScoringConfig {
  const preset = competitionFormatPreset(mode)
  const schedule = extra?.schedule ?? COMPETITION_SCHEDULE
  return mergeScheduleIntoScoringConfig({
    ...buildAmericanoScoringConfig(preset.americanoTarget, {
      games: schedule.games,
      breakMinutes: schedule.breakMinutes,
      gameMinutes: schedule.gameMinutes,
    }),
    competition_player_mode: mode,
    ...(extra?.teams ? { teams: extra.teams } : {}),
    ...(extra?.leagueId ? { league_id: extra.leagueId } : {}),
    ...(extra?.leagueWeek ? { league_week: extra.leagueWeek } : {}),
  }, schedule)
}

export function competitionSessionFields(
  mode: CompetitionPlayerMode,
  opts: {
    skillLevel: SkillLevel
    gender: Gender
    targetPlayers: number
    schedule?: CompetitionScheduleValues
  },
) {
  const preset = competitionFormatPreset(mode)
  const schedule = opts.schedule ?? COMPETITION_SCHEDULE
  const scoring_config = competitionScoringConfig(mode, { schedule })
  const rules =
    mode === 'duos'
      ? `Duos · ${preset.americanoTarget} games · fixed pairs · ${schedule.games} rounds`
      : buildRulesText('americano', null, {
          target: preset.americanoTarget,
          unit: 'games',
        })

  return {
    skill_level: opts.skillLevel,
    gender: opts.gender,
    rules,
    target_players: opts.targetPlayers,
    max_players: opts.targetPlayers,
    player_cap_mode: 'strict' as const,
    partnership_mode:
      mode === 'duos' ? ('fixed_pairs' as const) : rulesToPartnershipMode('americano', null),
    scoring_preset: 'standard' as const,
    scoring_config,
    who_can_log_matches: 'roster_members' as const,
    margin_bonus_enabled: true,
  }
}

export function teamsFromConfig(
  config: ScoringConfig | null | undefined,
): CompetitionTeamConfig[] {
  const raw = config?.teams
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (t): t is CompetitionTeamConfig =>
      Boolean(t) &&
      typeof t.label === 'string' &&
      Array.isArray(t.roster_ids) &&
      t.roster_ids.length === 2,
  )
}

function duoNameKey(names: string[]): string {
  return names.map((n) => n.trim()).sort().join('|')
}

function activeSideNames(names: string[]): string[] {
  return names.map((n) => n.trim()).filter((n) => n && n !== OPEN_SLOT_NAME)
}

/** Build duo teams for play UI from config, session pairs, and roster slot positions. */
export function duoTeamsForPlay(
  roster: Array<{ id: string; rank_order?: number | null }>,
  config: ScoringConfig | null | undefined,
  slotCount: number,
  pairs?: Array<{
    pair_label?: string | null
    roster_a_id?: string | null
    roster_b_id?: string | null
  }>,
): CompetitionTeamConfig[] {
  const configTeams = teamsFromConfig(config)
  const teamCount = Math.max(2, teamsFromCourtCount(courtCountFromPlayers(slotCount)))
  const byRank = new Map(
    roster
      .filter((player) => player.rank_order != null)
      .map((player) => [player.rank_order as number, player.id]),
  )
  const rankByRosterId = new Map(
    roster.map((player) => [player.id, player.rank_order ?? 0]),
  )
  const orderedPairs = orderSessionPairsByTeamIndex(pairs ?? [], rankByRosterId, teamCount)

  return Array.from({ length: teamCount }, (_, index) => {
    const pair = orderedPairs[index]
    const cfg = configTeams[index]
    return {
      label: pair?.pair_label?.trim() || cfg?.label?.trim() || `Team ${index + 1}`,
      roster_ids: [
        pair?.roster_a_id ?? cfg?.roster_ids?.[0] ?? byRank.get(index * 2) ?? '',
        pair?.roster_b_id ?? cfg?.roster_ids?.[1] ?? byRank.get(index * 2 + 1) ?? '',
      ] as [string, string],
    }
  })
}

/** Match live court side names to configured duo team labels. */
export function duoLabelsForMatch(
  teams: CompetitionTeamConfig[],
  rosterNamesById: Map<string, string>,
  teamANames: string[],
  teamBNames: string[],
  teamARosterIds?: (string | null)[],
  teamBRosterIds?: (string | null)[],
): { teamALabel?: string; teamBLabel?: string } {
  const labelForSide = (names: string[], rosterIds?: (string | null)[]) => {
    const activeNames = activeSideNames(names)
    const activeRosterIds = (rosterIds ?? []).filter((id): id is string => Boolean(id))

    for (const team of teams) {
      const [ridA, ridB] = team.roster_ids
      const teamRosterIds = [ridA, ridB].filter(Boolean)
      const teamNames = teamRosterIds
        .map((id) => rosterNamesById.get(id) ?? '')
        .filter((name) => name.trim() && name !== OPEN_SLOT_NAME)

      if (activeRosterIds.some((id) => teamRosterIds.includes(id))) {
        return team.label.trim() || teamNames.join(' & ') || undefined
      }

      if (activeNames.some((name) => teamNames.some((tn) => tn.toLowerCase() === name.toLowerCase()))) {
        return team.label.trim() || teamNames.join(' & ') || undefined
      }

      if (activeNames.length >= 2 && teamNames.length >= 2 && duoNameKey(activeNames) === duoNameKey(teamNames)) {
        return team.label.trim() || teamNames.join(' & ')
      }
    }
    return undefined
  }
  return {
    teamALabel: labelForSide(teamANames, teamARosterIds),
    teamBLabel: labelForSide(teamBNames, teamBRosterIds),
  }
}
