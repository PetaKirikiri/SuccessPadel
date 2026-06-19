import type { CompetitionRow, CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import type { TranslateFn } from '../i18n'
import type { DuoTeamDraft } from './competitionDuoTeams'
import { isDuoCompetition, teamsFromConfig } from './competitionFormatPresets'
import { teamsFromCourtCount, courtCountFromPlayers } from './competitionLayout'
import {
  americanoScheduleFromSession,
  breakMinutesFromConfig,
  competitionPlayStartFromAnchorIso,
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
import type { RosterSlot, RuleChip } from './friendlyGameDisplay'
import type { GameSession } from './types'

const BANGKOK = 'Asia/Bangkok'

export function competitionScheduleDisplay(
  row: Pick<GameSession, 'starts_at' | 'ends_at' | 'starts_on' | 'title'>,
): { dateLine: string; timeLine: string } {
  if (row.starts_at) {
    const start = competitionPlayStartFromAnchorIso(row.starts_at)
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

export function competitionRosterSlots(row: CompetitionRow): RosterSlot[] {
  const players = row.session_players ?? []
  const slots: RosterSlot[] = players.map((sp) => ({
    name: rosterDisplayName(sp),
    profileId: sp.profile_id,
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
    profileId: sp.profile_id,
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

  if (pairs.length > 0) {
    return Array.from({ length: teamCount }, (_, index) => {
      const pair = pairs[index]
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

export function competitionRuleChips(row: CompetitionRow, t: TranslateFn): RuleChip[] {
  const isDuos = isDuoCompetition(row)
  const isAmericano = usesAmericanoScoring(row)
  const schedule = americanoScheduleFromSession(row)
  const breakMinutes = breakMinutesFromConfig(row.scoring_config)
  const gameMinutes = gameMinutesFromConfig(
    row.scoring_config,
    0,
    schedule.totalGames,
    breakMinutes,
  )

  const chips: RuleChip[] = [
    {
      key: 'format',
      label: isDuos ? t('competition.formatDuos') : ruleFormatLabel(isAmericano ? 'americano' : 'king_of_court'),
      hintKey: isDuos ? 'competition.hintDuosFormat' : 'friendly.hint.format',
      icon: isDuos ? 'rounds' : isAmericano ? 'americano' : 'king',
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
    if (unit === 'open') {
      chips.push({
        key: 'scoring',
        label: t('friendly.chip.open'),
        hintKey: 'friendly.hint.scoringOpen',
        icon: 'scoring',
      })
    } else if (unit === 'games') {
      const n = target ?? 6
      chips.push({
        key: 'scoring',
        label: t('friendly.chip.firstToGames', { n }),
        hintKey: 'friendly.hint.scoringFirstTo',
        hintParams: { n },
        icon: 'scoring',
      })
    } else {
      const scoring =
        unit === 'sets' ? `${target ?? 4} sets` : `${target ?? 24} pts`
      chips.push({
        key: 'scoring',
        label: scoring,
        hintKey: 'friendly.hint.scoring',
        icon: 'scoring',
      })
    }
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
