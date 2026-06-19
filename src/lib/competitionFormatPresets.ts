import {
  buildAmericanoScoringConfig,
  buildRulesText,
  ruleFormatLabel,
  rulesToPartnershipMode,
  type Gender,
  type SkillLevel,
} from './competitionPresets'
import { americanoScheduleUsedMinutes, playersFromCourtCount, teamsFromCourtCount } from './competitionLayout'
import { RANKED_AMERICANO_GAMES, RANKED_GAME_MINUTES } from './competitionScheduleConstants'
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
export const DUO_GAME_COUNT = 5
export const DUO_GAME_MINUTES = 20
export const DUO_BREAK_MINUTES = 4
export const DUO_LEAGUE_WEEKS = 6

export const SINGLES_COMPETITION = {
  playerMode: 'singles' as const,
  targetPlayers: 16 as const,
  gameCount: RANKED_AMERICANO_GAMES,
  americanoTarget: 6 as const,
  breakMinutes: 3,
  gameMinutes: RANKED_GAME_MINUTES,
} as const

export const DUO_COMPETITION = {
  playerMode: 'duos' as const,
  targetPlayers: DUO_PLAYER_COUNT,
  teamCount: DUO_TEAM_COUNT,
  gameCount: DUO_GAME_COUNT,
  americanoTarget: 6 as const,
  breakMinutes: DUO_BREAK_MINUTES,
  gameMinutes: DUO_GAME_MINUTES,
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
  opts?: { gameCount?: number; courtCount?: number },
): RuleChip[] {
  const preset = competitionFormatPreset(mode)
  const gameCount = opts?.gameCount ?? preset.gameCount
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
      label: t('friendly.chip.firstToGames', { n: preset.americanoTarget }),
      hintKey: 'friendly.hint.scoringFirstTo',
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
      label: t('friendly.chip.minsPerGame', { n: preset.gameMinutes }),
      hintKey: 'friendly.hint.gameMinutes',
      icon: 'game-minutes',
    },
    {
      key: 'break',
      label: t('friendly.chip.minBreaks', { n: preset.breakMinutes }),
      hintKey: 'friendly.hint.break',
      icon: 'break',
    },
  )
  return chips
}

export function competitionEventMinutes(
  mode: CompetitionPlayerMode,
  gameCount?: number,
): number {
  const preset = competitionFormatPreset(mode)
  const games = gameCount ?? preset.gameCount
  return americanoScheduleUsedMinutes(games, preset.gameMinutes, preset.breakMinutes)
}

export function competitionScoringConfig(
  mode: CompetitionPlayerMode,
  extra?: {
    teams?: CompetitionTeamConfig[]
    leagueId?: string
    leagueWeek?: number
    gameCount?: number
  },
): ScoringConfig {
  const preset = competitionFormatPreset(mode)
  const gameCount = extra?.gameCount ?? preset.gameCount
  return {
    ...buildAmericanoScoringConfig(preset.americanoTarget, {
      games: gameCount,
      breakMinutes: preset.breakMinutes,
      gameMinutes: preset.gameMinutes,
    }),
    competition_player_mode: mode,
    ...(extra?.teams ? { teams: extra.teams } : {}),
    ...(extra?.leagueId ? { league_id: extra.leagueId } : {}),
    ...(extra?.leagueWeek ? { league_week: extra.leagueWeek } : {}),
  }
}

export function competitionSessionFields(
  mode: CompetitionPlayerMode,
  opts: { skillLevel: SkillLevel; gender: Gender; targetPlayers: number; gameCount?: number },
) {
  const preset = competitionFormatPreset(mode)
  const gameCount = opts.gameCount ?? preset.gameCount
  const scoring_config = competitionScoringConfig(mode, { gameCount })
  const rules =
    mode === 'duos'
      ? `Duos · ${preset.americanoTarget} games · fixed pairs · ${gameCount} rounds`
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
  return names.map((n) => n.trim().toLowerCase()).sort().join('|')
}

/** Match live court side names to configured duo team labels. */
export function duoLabelsForMatch(
  teams: CompetitionTeamConfig[],
  rosterNamesById: Map<string, string>,
  teamANames: string[],
  teamBNames: string[],
): { teamALabel?: string; teamBLabel?: string } {
  const labelForSide = (names: string[]) => {
    const key = duoNameKey(names)
    for (const team of teams) {
      const nameA = rosterNamesById.get(team.roster_ids[0]) ?? ''
      const nameB = rosterNamesById.get(team.roster_ids[1]) ?? ''
      if (!nameA || !nameB) continue
      const teamKey = duoNameKey([nameA, nameB])
      if (teamKey === key) {
        const fallback = `${nameA} & ${nameB}`
        return team.label.trim() || fallback
      }
    }
    return undefined
  }
  return {
    teamALabel: labelForSide(teamANames),
    teamBLabel: labelForSide(teamBNames),
  }
}
