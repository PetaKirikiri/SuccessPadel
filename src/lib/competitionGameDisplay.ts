import type { CompetitionRow } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import type { TranslateFn } from '../i18n'
import {
  americanoScheduleFromSession,
  breakMinutesFromConfig,
  gameMinutesFromConfig,
} from './competitionLayout'
import {
  americanoScoreTarget,
  americanoScoringUnit,
  partnerStyleLabel,
  ruleFormatLabel,
  usesAmericanoScoring,
  type PartnerStyle,
} from './competitionPresets'
import { formatClubTime, parseClubDate } from './courtSchedule'
import type { FriendlyRosterSlot, FriendlyRuleChip } from './friendlyGameDisplay'
import type { GameSession } from './types'

const BANGKOK = 'Asia/Bangkok'

export function competitionScheduleDisplay(
  row: Pick<GameSession, 'starts_at' | 'ends_at' | 'starts_on' | 'title'>,
): { dateLine: string; timeLine: string } {
  if (row.starts_at) {
    const start = new Date(row.starts_at)
    const dateLine = start.toLocaleDateString('en-GB', {
      timeZone: BANGKOK,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    const from = formatClubTime(start)
    const to = row.ends_at ? formatClubTime(new Date(row.ends_at)) : null
    return { dateLine, timeLine: to ? `${from}–${to}` : from }
  }

  if (row.starts_on) {
    const start = parseClubDate(row.starts_on)
    const dateLine = start.toLocaleDateString('en-GB', {
      timeZone: BANGKOK,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    return { dateLine, timeLine: '' }
  }

  return { dateLine: row.title, timeLine: '' }
}

export function competitionRosterSlots(row: CompetitionRow): FriendlyRosterSlot[] {
  const players = row.session_players ?? []
  const slots: FriendlyRosterSlot[] = players.map((sp) => ({
    name: rosterDisplayName(sp),
    profileId: sp.profile_id,
    avatarUrl: sp.profiles?.avatar_url ?? null,
    vacant: false,
  }))

  const cap = row.max_players ?? row.target_players
  if (cap == null || cap <= slots.length) return slots

  for (let i = slots.length; i < cap; i += 1) {
    slots.push({ name: '', profileId: null, avatarUrl: null, vacant: true })
  }
  return slots
}

export function competitionRuleChips(row: CompetitionRow, t: TranslateFn): FriendlyRuleChip[] {
  const isAmericano = usesAmericanoScoring(row)
  const schedule = americanoScheduleFromSession(row)
  const breakMinutes = breakMinutesFromConfig(row.scoring_config)
  const gameMinutes = gameMinutesFromConfig(
    row.scoring_config,
    0,
    schedule.totalGames,
    breakMinutes,
  )

  const chips: FriendlyRuleChip[] = [
    {
      key: 'format',
      label: isAmericano ? ruleFormatLabel('americano') : ruleFormatLabel('king_of_court'),
      hintKey: 'friendly.hint.format',
      icon: isAmericano ? 'americano' : 'king',
    },
  ]

  if (!isAmericano) {
    const style: PartnerStyle = row.partnership_mode === 'fixed_pairs' ? 'fixed' : 'swapped'
    chips.push({
      key: 'partners',
      label: partnerStyleLabel(style),
      hintKey: 'friendly.hint.partners',
      icon: style === 'fixed' ? 'partners-fixed' : 'partners-swapped',
    })
  } else {
    const unit = americanoScoringUnit(row)
    const target = americanoScoreTarget(row)
    const scoring =
      unit === 'open'
        ? t('friendly.chip.open')
        : unit === 'games'
          ? t('friendly.chip.bestOfGames', { n: target ?? 6 })
          : unit === 'sets'
            ? `${target ?? 4} sets`
            : `${target ?? 24} pts`
    chips.push({
      key: 'scoring',
      label: scoring,
      hintKey: 'friendly.hint.scoring',
      icon: 'scoring',
    })
  }

  chips.push(
    {
      key: 'rounds',
      label: t('friendly.chip.matches', { n: schedule.totalGames }),
      hintKey: 'friendly.hint.rounds',
      icon: 'rounds',
    },
    {
      key: 'gameMin',
      label: t('friendly.chip.minsPerGame', { n: gameMinutes }),
      hintKey: 'friendly.hint.gameMinutes',
      icon: 'game-minutes',
    },
  )

  if (breakMinutes > 0) {
    chips.push({
      key: 'break',
      label: t('friendly.chip.minBreaks', { n: breakMinutes }),
      hintKey: 'friendly.hint.break',
      icon: 'break',
    })
  }

  return chips
}
