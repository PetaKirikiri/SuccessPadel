const STORAGE_PREFIX = 'successpadel:competition-draft:'

export type CompetitionPlayerMode = 'singles' | 'duos'

export type DuoTeamDraftSlot = {
  label: string
  names: [string, string]
}

export type CompetitionFormDraft = {
  v: 6
  savedAt: string
  playerMode: CompetitionPlayerMode
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

export function competitionDraftKey(scope: 'new' | string): string {
  return `${STORAGE_PREFIX}${scope}`
}

export function loadCompetitionFormDraft(scope: 'new' | string): CompetitionFormDraft | null {
  try {
    const raw = localStorage.getItem(competitionDraftKey(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CompetitionFormDraft
    if (parsed?.v !== 6) return null
    return parsed
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
      v: 6,
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
