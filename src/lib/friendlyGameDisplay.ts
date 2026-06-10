import { courtsNeeded } from './competitionLayout'
import {
  partnerStyleLabel,
  ruleFormatLabel,
  type AmericanoScoringChoice,
} from './competitionPresets'
import type { TranslateFn } from '../i18n'
import {
  formatClubDateShort,
  formatClubTime,
  formatHourLabel,
  parseClubDate,
} from './courtSchedule'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyFilledSlots,
  friendlyOrganizedSession,
  friendlyEndsAtIso,
  friendlySessionTiming,
  friendlyStartsAtIso,
  friendlyVacantSlots,
  isEndlessFriendly,
  type FriendlyGameRecord,
} from './friendlyGames'
import type { GameSession } from './types'

export type FriendlyRosterSlot = {
  name: string
  profileId: string | null
  avatarUrl: string | null
  vacant: boolean
}

export type FriendlyRuleIcon =
  | 'americano'
  | 'king'
  | 'partners-fixed'
  | 'partners-swapped'
  | 'scoring'
  | 'rounds'
  | 'game-minutes'
  | 'break'

export type FriendlyRuleChip = {
  key: string
  label: string
  hintKey: string
  icon: FriendlyRuleIcon
}

export type FriendlyScheduleDisplay = {
  dateLine: string
  timeLine: string
  posted: boolean
}

const BANGKOK = 'Asia/Bangkok'

export function friendlyScheduleDisplay(game: FriendlyGameRecord): FriendlyScheduleDisplay {
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  if (game.playMode !== 'free' && config.day) {
    const timing = friendlySessionTiming(config)
    if (!timing) {
      return { dateLine: '', timeLine: '', posted: false }
    }
    const { sessionStart, sessionEnd } = timing
    const dateLine = sessionStart.toLocaleDateString('en-GB', {
      timeZone: BANGKOK,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    const timeLine = `${formatClubTime(sessionStart)}–${formatClubTime(sessionEnd)}`
    return { dateLine, timeLine, posted: false }
  }

  const postedAt = new Date(game.createdAt)
  const dateLine = postedAt.toLocaleDateString('en-GB', {
    timeZone: BANGKOK,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const timeLine = postedAt.toLocaleTimeString('en-GB', {
    timeZone: BANGKOK,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return { dateLine, timeLine, posted: true }
}

export function friendlyRosterSlots(game: FriendlyGameRecord): FriendlyRosterSlot[] {
  const ids = game.profileIds ?? []
  const avatars = game.profileAvatars ?? []
  return game.players.map((name, i) => ({
    name: name.trim(),
    profileId: ids[i] ?? null,
    avatarUrl: avatars[i] ?? null,
    vacant: !name.trim() && !ids[i],
  }))
}

export function friendlyWhenLabel(game: FriendlyGameRecord): string {
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  if (game.playMode !== 'free' && config.day) {
    const date = formatClubDateShort(parseClubDate(config.day))
    return `${date} · ${formatHourLabel(config.startHour, config.startMinute ?? 0)}`
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(game.createdAt))
}

export function friendlyRulesSummary(game: FriendlyGameRecord): string {
  if (isEndlessFriendly(game)) return 'Endless · gesture log test'
  if (game.playMode === 'free') return ''
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  return friendlyOrganizedSession(config).rules ?? ''
}

export function friendlyRuleChips(game: FriendlyGameRecord, t: TranslateFn): FriendlyRuleChip[] {
  if (game.playMode === 'free') return []
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  const formatIcon: FriendlyRuleIcon =
    config.ruleFormat === 'americano' ? 'americano' : 'king'
  const chips: FriendlyRuleChip[] = [
    {
      key: 'format',
      label: ruleFormatLabel(config.ruleFormat),
      hintKey: 'friendly.hint.format',
      icon: formatIcon,
    },
  ]
  if (config.ruleFormat === 'king_of_court') {
    chips.push({
      key: 'partners',
      label: partnerStyleLabel(config.partnerStyle),
      hintKey: 'friendly.hint.partners',
      icon: config.partnerStyle === 'fixed' ? 'partners-fixed' : 'partners-swapped',
    })
  }
  if (config.ruleFormat === 'americano') {
    const scoring =
      config.americanoScoring === 'open'
        ? t('friendly.chip.open')
        : t('friendly.chip.bestOfGames', {
            n: config.americanoScoring as Exclude<AmericanoScoringChoice, 'open'>,
          })
    chips.push({
      key: 'scoring',
      label: scoring,
      hintKey: 'friendly.hint.scoring',
      icon: 'scoring',
    })
    chips.push({
      key: 'rounds',
      label: t('friendly.chip.matches', { n: config.gameCount }),
      hintKey: 'friendly.hint.rounds',
      icon: 'rounds',
    })
    chips.push({
      key: 'gameMin',
      label: t('friendly.chip.minsPerGame', { n: config.gameMinutes }),
      hintKey: 'friendly.hint.gameMinutes',
      icon: 'game-minutes',
    })
    if (config.breakMinutes > 0) {
      chips.push({
        key: 'break',
        label: t('friendly.chip.minBreaks', { n: config.breakMinutes }),
        hintKey: 'friendly.hint.break',
        icon: 'break',
      })
    }
  }
  return chips
}

export function friendlyEndTimeLabel(game: FriendlyGameRecord): string | null {
  if (game.playMode === 'free') return null
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  const timing = friendlySessionTiming(config)
  if (!timing) return null
  return formatClubTime(timing.sessionEnd)
}

export function friendlyOpenSpots(game: FriendlyGameRecord): number {
  return friendlyVacantSlots(game)
}

export function friendlyListCardTiming(
  game: FriendlyGameRecord,
): Pick<GameSession, 'starts_at' | 'ends_at' | 'status' | 'scoring_config'> | null {
  if (game.playMode === 'free') return null
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  if (!config.day) return null
  const starts_at = friendlyStartsAtIso(config)
  const ends_at = friendlyEndsAtIso(config)
  if (!starts_at || !ends_at) return null
  const session = friendlyOrganizedSession(config)
  return {
    starts_at,
    ends_at,
    status: game.status === 'complete' ? 'complete' : 'open',
    scoring_config: {
      ...session.scoring_config,
      americano_games: config.gameCount,
      break_minutes: config.breakMinutes,
      game_minutes: config.gameMinutes,
    },
  }
}

export function friendlyLayoutSpiel(game: FriendlyGameRecord): string {
  if (game.playMode === 'free') return ''
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  const rosterCount = friendlyFilledSlots(game)
  const courts = courtsNeeded(Math.max(rosterCount, 4))
  const parts = [friendlyRulesSummary(game)]
  if (courts > 0) parts.push(`${courts} court${courts === 1 ? '' : 's'}`)
  if (rosterCount > 0) parts.push(`${rosterCount} players`)
  parts.push(
    `${config.gameCount} games · ${config.gameMinutes} min + ${config.breakMinutes} min break`,
  )
  return parts.filter(Boolean).join(' · ')
}
