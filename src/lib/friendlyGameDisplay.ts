import {
  americanoTargetLabel,
  partnerStyleLabel,
  ruleFormatLabel,
  type AmericanoScoringChoice,
} from './competitionPresets'
import { clubHourToDate, formatClubDateShort, formatHourLabel, parseClubDate } from './courtSchedule'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyVacantSlots,
  type FriendlyGameRecord,
} from './friendlyGames'

export type FriendlyRosterSlot = {
  name: string
  profileId: string | null
  avatarUrl: string | null
  vacant: boolean
}

export type FriendlyRuleChip = {
  key: string
  label: string
  hintKey: string
}

const BANGKOK = 'Asia/Bangkok'

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
    return `${date} · ${formatHourLabel(config.startHour)}`
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
  if (game.playMode === 'free') return ''
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  return friendlyOrganizedSession(config).rules ?? ''
}

export function friendlyRuleChips(game: FriendlyGameRecord): FriendlyRuleChip[] {
  if (game.playMode === 'free') return []
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  const chips: FriendlyRuleChip[] = [
    { key: 'format', label: ruleFormatLabel(config.ruleFormat), hintKey: 'friendly.hint.format' },
  ]
  if (config.ruleFormat === 'king_of_court') {
    chips.push({
      key: 'partners',
      label: partnerStyleLabel(config.partnerStyle),
      hintKey: 'friendly.hint.partners',
    })
  }
  if (config.ruleFormat === 'americano') {
    const scoring =
      config.americanoScoring === 'open'
        ? 'Open'
        : `${americanoTargetLabel(config.americanoScoring as Exclude<AmericanoScoringChoice, 'open'>)} games max`
    chips.push({ key: 'scoring', label: scoring, hintKey: 'friendly.hint.scoring' })
    chips.push({
      key: 'rounds',
      label: `${config.gameCount} games total`,
      hintKey: 'friendly.hint.rounds',
    })
    chips.push({
      key: 'gameMin',
      label: `${config.gameMinutes} min/game`,
      hintKey: 'friendly.hint.gameMinutes',
    })
    if (config.breakMinutes > 0) {
      chips.push({
        key: 'break',
        label: `${config.breakMinutes} min breaks`,
        hintKey: 'friendly.hint.break',
      })
    }
  }
  return chips
}

export function friendlyEndTimeLabel(game: FriendlyGameRecord): string | null {
  if (game.playMode === 'free') return null
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  if (!config.day) return null
  const start = clubHourToDate(config.day, config.startHour)
  const totalMin =
    config.gameCount * config.gameMinutes + Math.max(0, config.gameCount - 1) * config.breakMinutes
  const end = new Date(start.getTime() + totalMin * 60_000)
  return end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function friendlyOpenSpots(game: FriendlyGameRecord): number {
  return friendlyVacantSlots(game)
}
