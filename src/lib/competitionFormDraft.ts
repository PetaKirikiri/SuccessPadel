import type {
  AmericanoScoringChoice,
  Gender,
  PartnerStyle,
  RuleFormat,
  SkillLevel,
} from './competitionPresets'

const STORAGE_PREFIX = 'successpadel:competition-draft:'

export type CompetitionFormDraft = {
  v: 1
  savedAt: string
  day: string
  startHour: number
  duration: number
  skillLevel: SkillLevel
  gender: Gender
  targetPlayers: 4 | 8 | 12 | 16
  ruleFormat: RuleFormat
  partnerStyle: PartnerStyle
  americanoScoring: AmericanoScoringChoice
  gameCount: number
  gameMinutes: number
  breakMinutes: number
  title: string
  playerSlots: string[]
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
    if (parsed?.v !== 1) return null
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
      v: 1,
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
