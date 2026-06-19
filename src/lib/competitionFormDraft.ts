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
  v: 7
  savedAt: string
  playerMode: CompetitionPlayerMode
  courtCount: CourtCount
  createLeague: boolean
  day: string
  startHour: number
  startMinute: number
  skillLevel: string
  gender: string
  title: string
  titleEdited: boolean
  playerSlots: string[]
  duoTeams: DuoTeamDraftSlot[]
  previewSeed: number
}

type LegacyDraftV6 = Omit<CompetitionFormDraft, 'v' | 'courtCount'> & { v: 6 }

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
    const parsed = JSON.parse(raw) as CompetitionFormDraft | LegacyDraftV6
    if (parsed?.v === 7) return parsed
    if (parsed?.v === 6) {
      return {
        ...parsed,
        v: 7,
        courtCount: courtCountFromLegacyDraft(parsed),
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
      v: 7,
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
