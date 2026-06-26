import {
  courtCountFromPlayers,
  DEFAULT_DUO_COURT_COUNT,
  DEFAULT_SINGLES_COURT_COUNT,
  type CourtCount,
} from './competitionLayout'

const STORAGE_PREFIX = 'successpadel:competition-draft:'

export type CompetitionPlayerMode = 'singles' | 'duos'

export type DuoTeamDraftSlot = {
  label: string
  names: [string, string]
}

export type CompetitionFormDraft = {
  v: 9
  savedAt: string
  playerMode: CompetitionPlayerMode
  courtCount: CourtCount
  gameCount: number
  gameMinutes: number
  breakMinutes: number
  createLeague: boolean
  day: string
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
  skillLevel: string
  gender: string
  title: string
  titleEdited: boolean
  playerSlots: string[]
  duoTeams: DuoTeamDraftSlot[]
  previewSeed: number
}

type LegacyDraftV7 = Omit<
  CompetitionFormDraft,
  'v' | 'gameCount' | 'gameMinutes' | 'breakMinutes' | 'endHour' | 'endMinute'
> & {
  v: 7
}
type LegacyDraftV6 = Omit<LegacyDraftV7, 'v' | 'courtCount'> & { v: 6 }
type LegacyDraftV8 = Omit<CompetitionFormDraft, 'v' | 'endHour' | 'endMinute'> & { v: 8 }

function courtCountFromLegacyDraft(draft: LegacyDraftV6): CourtCount {
  if (draft.playerMode === 'duos' && draft.duoTeams.length >= 2) {
    return courtCountFromPlayers(draft.duoTeams.length * 2)
  }
  if (draft.playerSlots.length >= 4) {
    return courtCountFromPlayers(draft.playerSlots.length)
  }
  return draft.playerMode === 'duos' ? DEFAULT_DUO_COURT_COUNT : DEFAULT_SINGLES_COURT_COUNT
}

export function competitionDraftKey(scope: 'new' | string): string {
  return `${STORAGE_PREFIX}${scope}`
}

export function loadCompetitionFormDraft(scope: 'new' | string): CompetitionFormDraft | null {
  try {
    const raw = localStorage.getItem(competitionDraftKey(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CompetitionFormDraft | LegacyDraftV8 | LegacyDraftV7 | LegacyDraftV6
    if (parsed?.v === 9) return parsed
    if (parsed?.v === 8) {
      return {
        ...parsed,
        v: 9,
        endHour: 20,
        endMinute: 0,
      }
    }
    if (parsed?.v === 7) {
      return {
        ...parsed,
        v: 9,
        gameCount: 7,
        gameMinutes: 14,
        breakMinutes: 3,
        endHour: 20,
        endMinute: 0,
      }
    }
    if (parsed?.v === 6) {
      return {
        ...parsed,
        v: 9,
        courtCount: courtCountFromLegacyDraft(parsed),
        gameCount: 7,
        gameMinutes: 14,
        breakMinutes: 3,
        endHour: 20,
        endMinute: 0,
      }
    }
    return null
  } catch {
    return null
  }
}

export function saveCompetitionFormDraft(
  scope: 'new' | string,
  draft: Omit<CompetitionFormDraft, 'v' | 'savedAt'>,
): void {
  try {
    const payload: CompetitionFormDraft = {
      v: 9,
      savedAt: new Date().toISOString(),
      ...draft,
    }
    localStorage.setItem(competitionDraftKey(scope), JSON.stringify(payload))
  } catch {
    // private mode / quota — ignore
  }
}

export function clearCompetitionFormDraft(scope: 'new' | string): void {
  try {
    localStorage.removeItem(competitionDraftKey(scope))
  } catch {
    // ignore
  }
}

export function formatDraftSavedAt(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}
