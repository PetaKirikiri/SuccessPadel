import type {
  FriendlyGameRecord,
  FriendlyOrganizedConfig,
  FriendlyPlayMode,
  FriendlyVisibility,
} from './friendlyGames'
import { isLocalFriendlyId } from './friendlyGames'
import { supabase } from './supabaseClient'

type FriendlySessionRow = {
  id: string
  created_at: string
  created_by: string
  title: string
  visibility: FriendlyVisibility
  play_mode: FriendlyPlayMode
  status: 'ready' | 'complete'
  players: string[]
  profile_ids: (string | null)[]
  profile_avatars: (string | null)[]
  organized_config: FriendlyOrganizedConfig | null
}

export type PublishFriendlyResult = {
  id: string | null
  error: string | null
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => (typeof v === 'string' ? v : ''))
}

function parseNullableStringArray(raw: unknown): (string | null)[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => (typeof v === 'string' ? v : null))
}

export function friendlyFromServerRow(row: FriendlySessionRow): FriendlyGameRecord {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    players: parseStringArray(row.players),
    profileIds: parseNullableStringArray(row.profile_ids),
    profileAvatars: parseNullableStringArray(row.profile_avatars),
    playMode: row.play_mode,
    visibility: row.visibility,
    organizedConfig: row.organized_config ?? undefined,
    status: row.status,
    createdBy: row.created_by,
  }
}

function friendlyRpcPayload(game: Omit<FriendlyGameRecord, 'id' | 'createdAt'>) {
  return {
    p_title: game.title,
    p_visibility: game.visibility ?? 'public',
    p_play_mode: game.playMode ?? 'free',
    p_players: game.players,
    p_profile_ids: game.profileIds ?? [],
    p_profile_avatars: game.profileAvatars ?? [],
    p_organized_config: game.organizedConfig ?? null,
  }
}

export async function publishFriendlySession(
  game: Omit<FriendlyGameRecord, 'id' | 'createdAt'>,
): Promise<PublishFriendlyResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) {
    return { id: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase.rpc(
    'upsert_friendly_session',
    friendlyRpcPayload(game),
  )
  if (error) {
    console.error('publishFriendlySession', error.message)
    return { id: null, error: error.message }
  }
  const id = data == null ? null : String(data)
  if (!id || isLocalFriendlyId(id)) {
    return { id: null, error: 'No session id returned' }
  }
  return { id, error: null }
}

export async function fetchFriendlyHomeGames(): Promise<{
  games: FriendlyGameRecord[]
  error: string | null
}> {
  const { data, error } = await supabase.rpc('list_friendly_home_sessions')
  if (error) {
    console.error('fetchFriendlyHomeGames', error.message)
    return { games: [], error: error.message }
  }
  if (!Array.isArray(data)) return { games: [], error: null }
  return {
    games: (data as FriendlySessionRow[]).map(friendlyFromServerRow),
    error: null,
  }
}

export async function fetchPublicFriendlyGames(): Promise<FriendlyGameRecord[]> {
  const { data, error } = await supabase.rpc('list_public_friendly_sessions')
  if (error || !Array.isArray(data)) return []
  return (data as FriendlySessionRow[]).map(friendlyFromServerRow)
}

export async function fetchFriendlySession(id: string): Promise<FriendlyGameRecord | null> {
  const { data, error } = await supabase.rpc('get_friendly_session', { p_id: id })
  if (error || !data) return null
  return friendlyFromServerRow(data as FriendlySessionRow)
}

export async function joinFriendlySession(id: string): Promise<string | null> {
  const { error } = await supabase.rpc('join_friendly_session', { p_id: id })
  return error?.message ?? null
}

export async function deleteFriendlySession(id: string): Promise<string | null> {
  const { error } = await supabase.rpc('delete_friendly_session', { p_id: id })
  return error?.message ?? null
}

export async function updateFriendlySession(
  id: string,
  game: Omit<FriendlyGameRecord, 'id' | 'createdAt' | 'createdBy'>,
): Promise<string | null> {
  const { error } = await supabase.rpc('update_friendly_session', {
    p_id: id,
    ...friendlyRpcPayload(game),
  })
  return error?.message ?? null
}
