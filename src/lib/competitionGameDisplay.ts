import type { CompetitionRow, CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import type { TranslateFn } from '../i18n'
import type { DuoTeamDraft } from './competitionDuoTeams'
import { orderSessionPairsByTeamIndex } from './competitionDuoTeams'
import { isDuoCompetition, teamsFromConfig, usesCompetitionGameScoring } from './competitionFormatPresets'
import { teamsFromCourtCount, courtCountFromPlayers } from './competitionLayout'
import {
  resolveCompetitionSchedule,
} from './competitionLayout'
import {
  AMERICANO_DEFAULT_GAMES,
  AMERICANO_DEFAULT_TARGET,
  americanoScoreTarget,
  americanoScoringUnit,
  partnerStyleLabel,
  ruleFormatLabel,
  type PartnerStyle,
} from './competitionPresets'
import { formatClubDateInvite, formatClubTimeLocalized, parseClubDate } from './courtSchedule'
import type { AppLocale } from './locale'
import type { RosterSlot, RuleChip } from './friendlyGameDisplay'
import type { GameSession } from './types'

export function competitionScheduleDisplay(
  row: Pick<
    GameSession,
    'starts_at' | 'ends_at' | 'starts_on' | 'title' | 'scoring_config' | 'target_players' | 'max_players'
  > & { session_pairs?: unknown[] },
  locale: AppLocale,
): { dateLine: string; timeLine: string } {
  const resolved = resolveCompetitionSchedule(row)
  if (resolved.playStartsAt) {
    const start = resolved.playStartsAt
    const dateLine = formatClubDateInvite(start, locale)
    const from = formatClubTimeLocalized(start, locale)
    const to = resolved.eventEndsAt ? formatClubTimeLocalized(resolved.eventEndsAt, locale) : null
    return { dateLine, timeLine: to ? `${from}–${to}` : from }
  }

  if (row.starts_on) {
    const start = parseClubDate(row.starts_on)
    const dateLine = formatClubDateInvite(start, locale)
    return { dateLine, timeLine: '' }
  }

  return { dateLine: row.title, timeLine: '' }
}

function rosterProfileId(sp: CompetitionPlayer): string | null {
  return sp.profile_id ?? sp.profiles?.id ?? null
}

export function competitionRosterSlots(row: CompetitionRow): RosterSlot[] {
  const players = row.session_players ?? []
  const slots: RosterSlot[] = players.map((sp) => ({
    name: rosterDisplayName(sp),
    profileId: rosterProfileId(sp),
    padelPlayerId: sp.padel_player_id,
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

export type CompetitionTeamSlot = {
  label: string
  players: [RosterSlot, RosterSlot]
  vacant: boolean
  pairId?: string | null
  teamIndex: number
}

function vacantRosterSlot(): RosterSlot {
  return { name: '', profileId: null, avatarUrl: null, vacant: true }
}

function playerRosterSlot(sp: CompetitionPlayer): RosterSlot {
  const name = rosterDisplayName(sp)
  return {
    name,
    profileId: rosterProfileId(sp),
    padelPlayerId: sp.padel_player_id,
    avatarUrl: sp.profiles?.avatar_url ?? null,
    vacant: !name.trim(),
  }
}

export function competitionDuoTeamSlots(row: CompetitionRow): CompetitionTeamSlot[] {
  const sorted = [...(row.session_players ?? [])].sort(
    (a, b) => (a.rank_order ?? 0) - (b.rank_order ?? 0),
  )
  const rosterById = new Map(sorted.map((player) => [player.id, player]))
  const rosterByRank = new Map(
    sorted
      .filter((player) => player.rank_order != null)
      .map((player) => [player.rank_order as number, player]),
  )
  const cap = row.max_players ?? row.target_players ?? sorted.length
  const teamCount = Math.max(1, teamsFromCourtCount(courtCountFromPlayers(cap)))
  const configTeams = teamsFromConfig(row.scoring_config)
  const pairs = row.session_pairs ?? []
  const rankByRosterId = new Map(
    sorted.map((player) => [player.id, player.rank_order ?? 0]),
  )
  const orderedPairs = orderSessionPairsByTeamIndex(pairs, rankByRosterId, teamCount)

  if (pairs.length > 0) {
    return Array.from({ length: teamCount }, (_, index) => {
      const pair = orderedPairs[index]
      const playerA = pair?.roster_a_id ? rosterById.get(pair.roster_a_id) : undefined
      const playerB = pair?.roster_b_id ? rosterById.get(pair.roster_b_id) : undefined
      const slotA = playerA ? playerRosterSlot(playerA) : vacantRosterSlot()
      const slotB = playerB ? playerRosterSlot(playerB) : vacantRosterSlot()
      return {
        label:
          pair?.pair_label?.trim() ||
          configTeams[index]?.label?.trim() ||
          `Team ${index + 1}`,
        players: [slotA, slotB],
        vacant: slotA.vacant && slotB.vacant,
        pairId: pair?.id ?? null,
        teamIndex: index,
      }
    })
  }

  return Array.from({ length: teamCount }, (_, index) => {
    const playerA = rosterByRank.get(index * 2)
    const playerB = rosterByRank.get(index * 2 + 1)
    const slotA = playerA ? playerRosterSlot(playerA) : vacantRosterSlot()
    const slotB = playerB ? playerRosterSlot(playerB) : vacantRosterSlot()
    return {
      label: configTeams[index]?.label?.trim() || `Team ${index + 1}`,
      players: [slotA, slotB],
      vacant: slotA.vacant && slotB.vacant,
      pairId: null,
      teamIndex: index,
    }
  })
}

export function duoTeamDraftsFromRow(row: CompetitionRow): DuoTeamDraft[] {
  const cap = row.max_players ?? row.target_players ?? row.session_players?.length ?? 8
  const teamCount = Math.max(1, teamsFromCourtCount(courtCountFromPlayers(cap)))
  const slots = competitionDuoTeamSlots(row)
  return Array.from({ length: teamCount }, (_, index) => {
    const team = slots[index]
    if (!team) {
      return {
        label: '',
        names: ['', ''] as [string, string],
        profileIds: [null, null] as [string | null, string | null],
        padelPlayerIds: [null, null] as [string | null, string | null],
      }
    }
    return {
      label: team.label,
      names: [team.players[0].name, team.players[1].name] as [string, string],
      profileIds: [team.players[0].profileId, team.players[1].profileId] as [
        string | null,
        string | null,
      ],
      padelPlayerIds: [team.players[0].padelPlayerId, team.players[1].padelPlayerId] as [
        string | null,
        string | null,
      ],
    }
  })
}

export function competitionInviteRoster(row: CompetitionRow): {
  slots: RosterSlot[]
  duoTeams: CompetitionTeamSlot[] | null
} {
  if (isDuoCompetition(row)) {
    return { slots: [], duoTeams: competitionDuoTeamSlots(row) }
  }
  return { slots: competitionRosterSlots(row), duoTeams: null }
}

function americanoScoringChip(
  row: Pick<GameSession, 'scoring_config' | 'partnership_mode' | 'rules'>,
  t: TranslateFn,
): { label: string; hintKey: string; hintParams?: Record<string, number> } | null {
  if (!usesCompetitionGameScoring(row)) return null
  const unit = americanoScoringUnit(row)
  const target = americanoScoreTarget(row)
  if (unit === 'open') {
    return { label: t('friendly.chip.open'), hintKey: 'friendly.hint.scoringOpen' }
  }
  if (unit === 'games' || unit === 'points') {
    const n = target ?? (unit === 'points' ? AMERICANO_DEFAULT_TARGET : AMERICANO_DEFAULT_GAMES)
    return {
      label: t('friendly.chip.firstToPoints', { n }),
      hintKey: 'friendly.hint.scoringFirstToPoints',
      hintParams: { n },
    }
  }
  const scoring = unit === 'sets' ? `${target ?? 4} sets` : `${target ?? 24} pts`
  return { label: scoring, hintKey: 'friendly.hint.scoring' }
}

export function competitionInviteScoringHeadline(
  row: CompetitionRow,
  t: TranslateFn,
): string | null {
  return americanoScoringChip(row, t)?.label ?? null
}

export function competitionRuleChips(row: CompetitionRow, t: TranslateFn): RuleChip[] {
  const isDuos = isDuoCompetition(row)
  const usesGameScoring = usesCompetitionGameScoring(row)
  const schedule = resolveCompetitionSchedule(row)
  const { breakMinutes, gameMinutes, totalGames } = schedule

  const chips: RuleChip[] = [
    {
      key: 'format',
      label: isDuos
        ? t('competition.formatDuos')
        : ruleFormatLabel(usesGameScoring ? 'americano' : 'king_of_court'),
      hintKey: isDuos ? 'competition.hintDuosFormat' : 'friendly.hint.format',
      icon: isDuos ? 'rounds' : usesGameScoring ? 'americano' : 'king',
    },
  ]

  if (!isDuos && !usesGameScoring) {
    const style: PartnerStyle = row.partnership_mode === 'fixed_pairs' ? 'fixed' : 'swapped'
    chips.push({
      key: 'partners',
      label: partnerStyleLabel(style),
      hintKey: 'friendly.hint.partners',
      icon: style === 'fixed' ? 'partners-fixed' : 'partners-swapped',
    })
  }

  if (schedule.playStartsAt && schedule.eventEndsAt) {
    const from = formatClubTimeLocalized(schedule.playStartsAt, 'en')
    const to = formatClubTimeLocalized(schedule.eventEndsAt, 'en')
    chips.push({
      key: 'time',
      label: `${from}-${to}`,
      hintKey: 'friendly.hint.time',
      icon: 'time',
    })
  }

  chips.push(
    {
      key: 'rounds',
      label: t('friendly.chip.matches', { n: totalGames }),
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
