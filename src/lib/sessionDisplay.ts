import type { CompetitionRow } from '../hooks/useCompetitions'
import type { TranslateFn } from '../i18n'
import {
  competitionInviteRoster,
  competitionRuleChips as ruleChipsFromCompetitionRow,
  competitionScheduleDisplay,
  type CompetitionTeamSlot,
} from './competitionGameDisplay'
import type { CompetitionPlayerMode } from './competitionFormatPresets'
import { presetRuleChips } from './competitionFormatPresets'
import type { FriendlyGameRecord } from './friendlyGames'
import {
  friendlyDivisionLabels,
  friendlyRosterSlots,
  friendlyRuleChips,
  friendlyScheduleDisplay,
  type RosterSlot,
  type RuleChip,
} from './friendlyGameDisplay'

export type SessionSource =
  | { kind: 'competition'; row: CompetitionRow }
  | { kind: 'friendly'; game: FriendlyGameRecord }
  | { kind: 'preset'; mode: CompetitionPlayerMode }

export type SessionScheduleDisplay = {
  dateLine: string
  timeLine: string
}

export type InviteCardData = {
  title: string
  dateLine: string
  timeLine: string
  detailTo: string
  slots: RosterSlot[]
  duoTeams: CompetitionTeamSlot[] | null
  ruleChips: RuleChip[]
  gender: string | null
}

export function sessionGender(source: SessionSource): string | null {
  if (source.kind === 'competition') return source.row.gender
  if (source.kind === 'friendly') return friendlyDivisionLabels(source.game).gender
  return null
}

function withDivisionChips(
  chips: RuleChip[],
  skillLevel: string | null | undefined,
  gender: string | null | undefined,
): RuleChip[] {
  const extra: RuleChip[] = []
  if (skillLevel) {
    extra.push({
      key: 'level',
      label: skillLevel,
      hintKey: 'friendly.hint.skillLevel',
      icon: 'level',
    })
  }
  if (gender) {
    extra.push({
      key: 'gender',
      label: gender,
      hintKey: 'friendly.hint.gender',
      icon: 'gender',
    })
  }
  return [...chips, ...extra]
}

export function scheduleDisplay(source: SessionSource): SessionScheduleDisplay {
  if (source.kind === 'competition') {
    return competitionScheduleDisplay(source.row)
  }
  if (source.kind === 'friendly') {
    const { dateLine, timeLine } = friendlyScheduleDisplay(source.game)
    return { dateLine, timeLine }
  }
  return { dateLine: '', timeLine: '' }
}

export function rosterSlots(source: SessionSource): RosterSlot[] {
  if (source.kind === 'competition') return competitionInviteRoster(source.row).slots
  if (source.kind === 'friendly') return friendlyRosterSlots(source.game)
  return []
}

export function ruleChips(
  source: SessionSource,
  t: TranslateFn,
  division?: { skillLevel?: string | null; gender?: string | null; gameCount?: number; courtCount?: number },
): RuleChip[] {
  if (source.kind === 'competition') {
    return withDivisionChips(
      ruleChipsFromCompetitionRow(source.row, t),
      source.row.skill_level,
      source.row.gender,
    )
  }
  if (source.kind === 'friendly') {
    const { skillLevel, gender } = friendlyDivisionLabels(source.game)
    return withDivisionChips(friendlyRuleChips(source.game, t), skillLevel, gender)
  }
  return withDivisionChips(
    presetRuleChips(source.mode, t, {
      gameCount: division?.gameCount,
      courtCount: division?.courtCount,
    }),
    division?.skillLevel,
    division?.gender,
  )
}

export function inviteCardData(
  source: SessionSource,
  t: TranslateFn,
  opts?: { detailTo?: string; statusLine?: string | null },
): InviteCardData {
  const schedule = scheduleDisplay(source)
  if (source.kind === 'competition') {
    const roster = competitionInviteRoster(source.row)
    return {
      title: source.row.title,
      dateLine: schedule.dateLine,
      timeLine: schedule.timeLine,
      detailTo: opts?.detailTo ?? `/competitions/${source.row.id}`,
      slots: roster.slots,
      duoTeams: roster.duoTeams,
      ruleChips: ruleChips(source, t),
      gender: sessionGender(source),
    }
  }
  if (source.kind === 'friendly') {
    return {
      title: source.game.title,
      dateLine: schedule.dateLine,
      timeLine: schedule.timeLine,
      detailTo: opts?.detailTo ?? `/friendly/${source.game.id}`,
      slots: rosterSlots(source),
      duoTeams: null,
      ruleChips: ruleChips(source, t),
      gender: sessionGender(source),
    }
  }
  return {
    title: '',
    dateLine: schedule.dateLine,
    timeLine: schedule.timeLine,
    detailTo: opts?.detailTo ?? '',
    slots: [],
    duoTeams: null,
    ruleChips: ruleChips(source, t),
    gender: null,
  }
}
