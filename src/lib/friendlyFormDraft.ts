import type {
  AmericanoScoringChoice,
  PartnerStyle,
  RuleFormat,
} from './competitionPresets'
import { formatDateInput } from './courtSchedule'
import { DEFAULT_FRIENDLY_ORGANIZED_CONFIG, FRIENDLY_MIN_PLAYERS } from './friendlyGames'
import type { FriendlyPlayMode, FriendlyVisibility } from './friendlyGames'

export type FriendlyFormRulesSetup = {
  ruleFormat: RuleFormat
  partnerStyle: PartnerStyle
  americanoScoring: AmericanoScoringChoice
  gameCount: number
  gameMinutes: number
  breakMinutes: number
}

const STORAGE_KEY = 'successpadel:friendly-form-draft'
const DRAFT_VERSION = 3

export type FriendlyFormDraft = {
  v: typeof DRAFT_VERSION
  savedAt: string
  title: string
  visibility: FriendlyVisibility
  day: string
  startHour: number
  playerSlots: string[]
  profileIds: (string | null)[]
  playMode: FriendlyPlayMode
  rulesSetup: FriendlyFormRulesSetup
  previewSeed: number
}

export type FriendlyFormValues = Omit<FriendlyFormDraft, 'v' | 'savedAt'>

function defaultRulesSetup(): FriendlyFormRulesSetup {
  const { ruleFormat, partnerStyle, americanoScoring, gameCount, gameMinutes, breakMinutes } =
    DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  return { ruleFormat, partnerStyle, americanoScoring, gameCount, gameMinutes, breakMinutes }
}

export function friendlyFormDefaults(): FriendlyFormValues {
  return {
    title: '',
    visibility: 'public',
    day: formatDateInput(new Date()),
    startHour: 18,
    playerSlots: Array.from({ length: FRIENDLY_MIN_PLAYERS }, () => ''),
    profileIds: Array.from({ length: FRIENDLY_MIN_PLAYERS }, () => null),
    playMode: 'free',
    rulesSetup: defaultRulesSetup(),
    previewSeed: 0,
  }
}

function padSlots(names: string[], ids: (string | null)[]): Pick<FriendlyFormValues, 'playerSlots' | 'profileIds'> {
  const len = Math.max(names.length, ids.length, FRIENDLY_MIN_PLAYERS)
  const playerSlots = Array.from({ length: len }, (_, i) => names[i] ?? '')
  const profileIds = Array.from({ length: len }, (_, i) => ids[i] ?? null)
  return { playerSlots, profileIds }
}

function normalizeRulesSetup(raw: unknown): FriendlyFormRulesSetup {
  const base = defaultRulesSetup()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<FriendlyFormRulesSetup>
  return {
    ruleFormat: r.ruleFormat ?? base.ruleFormat,
    partnerStyle: r.partnerStyle ?? base.partnerStyle,
    americanoScoring: r.americanoScoring ?? base.americanoScoring,
    gameCount: typeof r.gameCount === 'number' ? r.gameCount : base.gameCount,
    gameMinutes: typeof r.gameMinutes === 'number' ? r.gameMinutes : base.gameMinutes,
    breakMinutes: typeof r.breakMinutes === 'number' ? r.breakMinutes : base.breakMinutes,
  }
}

function migrateDraft(raw: Record<string, unknown>): FriendlyFormValues {
  const defaults = friendlyFormDefaults()
  const slots = padSlots(
    Array.isArray(raw.playerSlots) ? (raw.playerSlots as string[]) : defaults.playerSlots,
    Array.isArray(raw.profileIds) ? (raw.profileIds as (string | null)[]) : defaults.profileIds,
  )
  return {
    title: typeof raw.title === 'string' ? raw.title : defaults.title,
    visibility: raw.visibility === 'private' ? 'private' : 'public',
    day: typeof raw.day === 'string' && raw.day ? raw.day : defaults.day,
    startHour: typeof raw.startHour === 'number' ? raw.startHour : defaults.startHour,
    ...slots,
    playMode: raw.playMode === 'organized' ? 'organized' : 'free',
    rulesSetup: normalizeRulesSetup(raw.rulesSetup),
    previewSeed: typeof raw.previewSeed === 'number' ? raw.previewSeed : defaults.previewSeed,
  }
}

export function loadFriendlyFormDraft(): FriendlyFormDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null
    const v = parsed.v
    if (v !== 1 && v !== 2 && v !== 3) return null
    const values = migrateDraft(parsed)
    return {
      v: DRAFT_VERSION,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      ...values,
    }
  } catch {
    return null
  }
}

export function friendlyFormInitialState(): FriendlyFormValues {
  const draft = loadFriendlyFormDraft()
  if (!draft) return friendlyFormDefaults()
  const { v: _v, savedAt: _savedAt, ...values } = draft
  return values
}

export function saveFriendlyFormDraft(draft: FriendlyFormValues): void {
  try {
    const payload: FriendlyFormDraft = {
      v: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      ...draft,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function clearFriendlyFormDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
