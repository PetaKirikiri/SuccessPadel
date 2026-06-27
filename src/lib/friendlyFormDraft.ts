import type {
  AmericanoScoringChoice,
  Gender,
  PartnerStyle,
  RuleFormat,
  SkillLevel,
} from './competitionPresets'
import { clubTodayDateInput, normalizeClubDateInput } from './courtSchedule'
import type { FriendlyPlayMode, FriendlyVisibility } from './friendlyGames'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  FRIENDLY_MIN_PLAYERS,
  lockedFriendlyOrganizedRules,
} from './friendlyGames'
import { GAME_SETUP_MIN_BREAK_MINUTES } from './gameSchedule'
import type { FriendlyGameRecord } from './friendlyGames'

export type FriendlyFormRulesSetup = {
  ruleFormat: RuleFormat
  partnerStyle: PartnerStyle
  americanoScoring: AmericanoScoringChoice
  gameCount: number
  gameMinutes: number
  breakMinutes: number
  sessionEndHour?: number
  sessionEndMinute?: number
}

const STORAGE_KEY = 'successpadel:friendly-form-draft'
const DRAFT_VERSION = 5

export type FriendlyFormDraft = {
  v: typeof DRAFT_VERSION
  savedAt: string
  title: string
  visibility: FriendlyVisibility
  day: string
  startHour: number
  startMinute: number
  playerSlots: string[]
  profileIds: (string | null)[]
  playMode: FriendlyPlayMode
  rulesSetup: FriendlyFormRulesSetup
  previewSeed: number
  skillLevel: SkillLevel
  gender: Gender
}

export type FriendlyFormValues = Omit<FriendlyFormDraft, 'v' | 'savedAt'>

function defaultRulesSetup(): FriendlyFormRulesSetup {
  return lockedFriendlyOrganizedRules()
}

export function friendlyFormDefaults(): FriendlyFormValues {
  return {
    title: '',
    visibility: 'public',
    day: clubTodayDateInput(),
    startHour: 18,
    startMinute: 10,
    playerSlots: Array.from({ length: FRIENDLY_MIN_PLAYERS }, () => ''),
    profileIds: Array.from({ length: FRIENDLY_MIN_PLAYERS }, () => null),
    playMode: 'organized',
    rulesSetup: defaultRulesSetup(),
    previewSeed: 0,
    skillLevel: DEFAULT_FRIENDLY_ORGANIZED_CONFIG.skillLevel ?? 'Low Inter',
    gender: DEFAULT_FRIENDLY_ORGANIZED_CONFIG.gender ?? 'Mixed',
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
  const num = (v: unknown, fallback: number) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN
    return Number.isFinite(n) ? n : fallback
  }
  const optionalTimePart = (v: unknown, max: number) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN
    if (!Number.isFinite(n)) return undefined
    return Math.max(0, Math.min(max, Math.floor(n)))
  }
  return {
    ruleFormat: r.ruleFormat ?? base.ruleFormat,
    partnerStyle: r.partnerStyle ?? base.partnerStyle,
    americanoScoring: r.americanoScoring ?? base.americanoScoring,
    gameCount: num(r.gameCount ?? (r as { games?: unknown }).games, base.gameCount),
    gameMinutes: num(r.gameMinutes, base.gameMinutes),
    breakMinutes: Math.max(GAME_SETUP_MIN_BREAK_MINUTES, num(r.breakMinutes, base.breakMinutes)),
    sessionEndHour: optionalTimePart(r.sessionEndHour, 23),
    sessionEndMinute: optionalTimePart(r.sessionEndMinute, 59),
  }
}

function migrateDraft(raw: Record<string, unknown>): FriendlyFormValues {
  const defaults = friendlyFormDefaults()
  const slots = padSlots(
    Array.isArray(raw.playerSlots) ? (raw.playerSlots as string[]) : defaults.playerSlots,
    Array.isArray(raw.profileIds) ? (raw.profileIds as (string | null)[]) : defaults.profileIds,
  )
  const rulesSetup = normalizeRulesSetup(raw.rulesSetup)
  const oldDefaultSchedule =
    rulesSetup.gameCount === 7 &&
    rulesSetup.gameMinutes === 14 &&
    rulesSetup.breakMinutes === 3
  return {
    title: typeof raw.title === 'string' ? raw.title : defaults.title,
    visibility: raw.visibility === 'private' ? 'private' : 'public',
    day:
      typeof raw.day === 'string' && raw.day
        ? normalizeClubDateInput(raw.day)
        : defaults.day,
    startHour: typeof raw.startHour === 'number' ? raw.startHour : defaults.startHour,
    startMinute:
      typeof raw.startMinute === 'number'
        ? oldDefaultSchedule && raw.startMinute === 0
          ? defaults.startMinute
          : raw.startMinute
        : defaults.startMinute,
    ...slots,
    playMode: defaults.playMode,
    rulesSetup: oldDefaultSchedule ? defaults.rulesSetup : rulesSetup,
    previewSeed: typeof raw.previewSeed === 'number' ? raw.previewSeed : defaults.previewSeed,
    skillLevel:
      typeof raw.skillLevel === 'string' ? (raw.skillLevel as SkillLevel) : defaults.skillLevel,
    gender: typeof raw.gender === 'string' ? (raw.gender as Gender) : defaults.gender,
  }
}

export function loadFriendlyFormDraft(): FriendlyFormDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null
    const v = parsed.v
    if (v !== 1 && v !== 2 && v !== 3 && v !== 4 && v !== 5) return null
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

export function friendlyFormValuesFromGame(game: FriendlyGameRecord): FriendlyFormValues {
  const cfg = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  const defaults = friendlyFormDefaults()
  const len = Math.max(game.players.length, game.profileIds?.length ?? 0, FRIENDLY_MIN_PLAYERS)
  const playerSlots = Array.from({ length: len }, (_, i) => game.players[i] ?? '')
  const profileIds = Array.from(
    { length: len },
    (_, i) => game.profileIds?.[i] ?? null,
  )
  return {
    title: game.title,
    visibility: game.visibility ?? 'public',
    day: cfg.day || defaults.day,
    startHour: cfg.startHour ?? defaults.startHour,
    startMinute: cfg.startMinute ?? 0,
    playerSlots,
    profileIds,
    playMode: game.playMode ?? 'free',
    rulesSetup: normalizeRulesSetup({
      ruleFormat: cfg.ruleFormat,
      partnerStyle: cfg.partnerStyle,
      americanoScoring: cfg.americanoScoring,
      gameCount: cfg.gameCount,
      gameMinutes: cfg.gameMinutes,
      breakMinutes: cfg.breakMinutes,
      sessionEndHour: cfg.sessionEndHour,
      sessionEndMinute: cfg.sessionEndMinute,
    }),
    previewSeed: cfg.previewSeed ?? 0,
    skillLevel: cfg.skillLevel ?? defaults.skillLevel,
    gender: cfg.gender ?? defaults.gender,
  }
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

export function friendlyFormInitialState(): FriendlyFormValues {
  const draft = loadFriendlyFormDraft()
  if (!draft) return friendlyFormDefaults()
  const { v: _v, savedAt: _savedAt, ...values } = draft
  return values
}

export function clearFriendlyFormDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
