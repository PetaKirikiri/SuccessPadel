import { courtsNeeded } from './competitionLayout'
import {
  americanoTargetLabel,
  partnerStyleLabel,
  ruleFormatLabel,
  type AmericanoScoringChoice,
} from './competitionPresets'
import { clubHourToDate, formatClubDateShort, formatHourLabel, parseClubDate } from './courtSchedule'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyFilledSlots,
  friendlyOrganizedSession,
  friendlyStartsAtIso,
  friendlyVacantSlots,
  type FriendlyGameRecord,
} from './friendlyGames'
import type { GameSession } from './types'

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
  const start = clubHourToDate(config.day, config.startHour, config.startMinute ?? 0)
  const totalMin =
    config.gameCount * config.gameMinutes + Math.max(0, config.gameCount - 1) * config.breakMinutes
  const end = new Date(start.getTime() + totalMin * 60_000)
  return end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
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
  if (!starts_at) return null
  const start = clubHourToDate(config.day, config.startHour, config.startMinute ?? 0)
  const totalMin =
    config.gameCount * config.gameMinutes +
    Math.max(0, config.gameCount - 1) * config.breakMinutes
  const ends_at = new Date(start.getTime() + totalMin * 60_000).toISOString()
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
