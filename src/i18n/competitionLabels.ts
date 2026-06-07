import type { CompetitionCardPhase } from '../lib/competitionListCard'
import { competitionPhaseBadge } from '../lib/competitionListCard'
import type { TranslateFn } from './index'

export function translatePhaseBadge(t: TranslateFn, phase: CompetitionCardPhase): string | null {
  const raw = competitionPhaseBadge(phase)
  if (!raw) return null
  if (raw === 'Live') return t('competition.live')
  if (raw === 'Break') return t('competition.break')
  if (raw === 'Upcoming') return t('competition.upcoming')
  if (raw === 'Scheduled') return t('competition.scheduled')
  return raw
}

export function translateCountdownLabel(t: TranslateFn, label: string): string {
  if (label === 'Starts in') return t('competition.startsIn')
  if (label === 'Break') return t('competition.break')
  if (label === 'Event ends in') return t('competition.eventEndsIn')
  const gameMatch = /^Game (\d+) · (\d+) min$/.exec(label)
  if (gameMatch) {
    return t('competition.gameMinutes', { game: gameMatch[1]!, minutes: gameMatch[2]! })
  }
  return label
}
