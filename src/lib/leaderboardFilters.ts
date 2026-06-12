import { GENDERS, SKILL_LEVELS, type Gender, type SkillLevel } from './competitionPresets'
import type { RankMode } from './types'

export type LeaderboardGenderFilter = Gender | 'all'
export type LeaderboardSkillFilter = SkillLevel | 'all'

export type LeaderboardFilters = {
  rankMode: RankMode
  gender: LeaderboardGenderFilter
  skillLevel: LeaderboardSkillFilter
}

export const DEFAULT_LEADERBOARD_FILTERS: LeaderboardFilters = {
  rankMode: 'solo',
  gender: 'all',
  skillLevel: 'all',
}

export const LEADERBOARD_GENDER_OPTIONS: LeaderboardGenderFilter[] = ['all', ...GENDERS]
export const LEADERBOARD_SKILL_OPTIONS: LeaderboardSkillFilter[] = ['all', ...SKILL_LEVELS]
export const LEADERBOARD_RANK_MODES: RankMode[] = ['solo', 'duos']

export function leaderboardFiltersToRpc(filters: LeaderboardFilters) {
  return {
    p_season_id: null,
    p_gender: filters.gender === 'all' ? null : filters.gender,
    p_skill_level: filters.skillLevel === 'all' ? null : filters.skillLevel,
    p_rank_mode: filters.rankMode,
  }
}

export function isDuoLeaderboardEntry(profileId: string): boolean {
  return profileId.startsWith('duo:')
}
