import type { DuoTeamDraft } from './competitionDuoTeams'

const STORAGE_PREFIX = 'successpadel:invite-roster:'

export type InviteRosterDraft = {
  v: 1
  savedAt: string
  isDuos: boolean
  duoTeams?: DuoTeamDraft[]
  playerSlots?: string[]
  profileIds?: (string | null)[]
  padelPlayerIds?: (string | null)[]
}

export function inviteRosterDraftKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`
}

export function loadInviteRosterDraft(sessionId: string): InviteRosterDraft | null {
  try {
    const raw = sessionStorage.getItem(inviteRosterDraftKey(sessionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as InviteRosterDraft
    return parsed?.v === 1 ? parsed : null
  } catch {
    return null
  }
}

export function saveInviteRosterDraft(
  sessionId: string,
  draft: Omit<InviteRosterDraft, 'v' | 'savedAt'>,
): void {
  try {
    const payload: InviteRosterDraft = {
      v: 1,
      savedAt: new Date().toISOString(),
      ...draft,
    }
    sessionStorage.setItem(inviteRosterDraftKey(sessionId), JSON.stringify(payload))
  } catch {
    // sessionStorage full or private mode — ignore
  }
}

export function clearInviteRosterDraft(sessionId: string): void {
  try {
    sessionStorage.removeItem(inviteRosterDraftKey(sessionId))
  } catch {
    // ignore
  }
}
