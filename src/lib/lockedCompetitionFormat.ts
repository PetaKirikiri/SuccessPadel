import {
  SINGLES_COMPETITION,
  competitionEventMinutes,
  competitionRuleChips,
  competitionScoringConfig,
  competitionSessionFields,
} from './competitionFormatPresets'

/** @deprecated use SINGLES_COMPETITION from competitionFormatPresets */
export const LOCKED_COMPETITION = SINGLES_COMPETITION

export function lockedCompetitionRuleChips(t: Parameters<typeof competitionRuleChips>[1]) {
  return competitionRuleChips('singles', t)
}

export function lockedCompetitionEventMinutes() {
  return competitionEventMinutes('singles')
}

export function lockedCompetitionScoringConfig() {
  return competitionScoringConfig('singles')
}

export function lockedCompetitionSessionFields(opts: Parameters<typeof competitionSessionFields>[1]) {
  return competitionSessionFields('singles', opts)
}
