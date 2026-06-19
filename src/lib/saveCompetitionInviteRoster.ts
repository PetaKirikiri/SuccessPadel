import {
  duoTeamsToPairSlotPayload,
  duoTeamsToRosterSlots,
  type DuoTeamDraft,
} from './competitionDuoTeams'
import { buildCompetitionRosterSlots } from './competitionRosterSlots'
import { supabase } from './supabaseClient'

export async function saveCompetitionInviteDuoRoster(
  sessionId: string,
  teams: DuoTeamDraft[],
): Promise<string | null> {
  const slots = duoTeamsToRosterSlots(teams)
  const pairs = duoTeamsToPairSlotPayload(teams)
  const { error } = await supabase.rpc('sync_competition_roster_slots', {
    p_session_id: sessionId,
    p_slots: slots,
    p_pairs: pairs,
  })
  return error?.message ?? null
}

export async function saveCompetitionInviteSinglesRoster(
  sessionId: string,
  names: string[],
  profileIds: (string | null)[],
  padelPlayerIds: (string | null)[],
): Promise<string | null> {
  const { error } = await supabase.rpc('sync_competition_roster_slots', {
    p_session_id: sessionId,
    p_slots: buildCompetitionRosterSlots(names, profileIds, padelPlayerIds),
  })
  return error?.message ?? null
}
