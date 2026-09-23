import assert from 'node:assert/strict'
import { playerProfilePath } from '../src/lib/playerProfileSlug'
import { openPlayerProfile, resolvePlayerRouteId } from '../src/lib/openPlayerProfile'
import { resolvePlayerProfile } from '../src/lib/playerProfile'
import { supabase } from '../src/lib/supabaseClient'

// In-memory only: no login, player creation, recordings, or live match writes.
const accountId = '11111111-1111-4111-8111-111111111111'
const playerId = '22222222-2222-4222-8222-222222222222'
const otherId = '33333333-3333-4333-8333-333333333333'
const competitionId = '44444444-4444-4444-8444-444444444444'
const account = { id: accountId, display_name: 'Jansuda K.', line_user_id: 'test-line' }
let signedIn = false
let players = [{ id: playerId, display_name: 'Mamasung', profile_id: accountId, line_user_id: 'test-line' }]
const originalFrom = supabase.from
const originalRpc = supabase.rpc
const originalFetch = globalThis.fetch
globalThis.fetch = async () => { throw new Error('Unexpected network access in identity regression') }
const rpcCalls: string[] = []

supabase.from = ((table: string) => {
  assert.ok(['profiles', 'padel_players'].includes(table))
  let rows: Record<string, unknown>[] = table === 'profiles' ? (signedIn ? [account] : []) : [...players]
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query },
    ilike: (key: string, value: string) => {
      rows = rows.filter(row => String(row[key]).toLowerCase() === value.toLowerCase()); return query
    },
    maybeSingle: async () => ({ data: rows.length === 1 ? rows[0] : null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
  }
  return query
}) as typeof supabase.from
supabase.rpc = (async (name: string, args: { p_profile_id?: string }) => {
  rpcCalls.push(name)
  assert.equal(name, 'get_player_profile', 'Profile navigation must not create or link players')
  return { data: args.p_profile_id === accountId ? account : null, error: null }
}) as typeof supabase.rpc

try {
  for (const displayName of ['Mamasung', 'Jansuda K.', 'Meow', 'ชื่อใหม่ 🎾']) {
    assert.equal(playerProfilePath({ id: playerId, displayName, competitionId }),
      `/players/${playerId}?competition=${competitionId}`)
  }
  assert.equal(playerProfilePath({ id: accountId, displayName: 'Changed', suffix: '/history' }), `/players/${accountId}/history`)
  assert.equal(playerProfilePath({ displayName: 'Old Name' }), '/players/old-name')

  for (const login of [false, true]) {
    signedIn = login
    for (const displayName of ['Mamasung', 'Jansuda K.']) {
      const input = { profileId: accountId, padelPlayerId: playerId, displayName, competitionId }
      assert.equal(await resolvePlayerRouteId(input), playerId)
      let destination = ''
      await openPlayerProfile(((path: string) => { destination = path }) as never, input)
      assert.equal(destination, `/players/${playerId}?competition=${competitionId}`)
      const resolved = await resolvePlayerProfile(destination.split('?')[0]!.split('/').pop()!)
      assert.equal(resolved.padelPlayerId, playerId, 'CoachRecorder receives the same player ID before/after sign-in')
      assert.equal(resolved.profile?.id, accountId)
    }
    assert.equal((await resolvePlayerProfile(accountId)).padelPlayerId, playerId)
    assert.equal((await resolvePlayerProfile('mamasung')).padelPlayerId, playerId)
    assert.equal(await resolvePlayerRouteId({ displayName: 'Mamasung' }), playerId)
    assert.equal(await resolvePlayerRouteId({ displayName: 'Unknown person' }), null)
    assert.equal((await resolvePlayerProfile('unknown-person')).padelPlayerId, null)
  }
  // A linked profile and its roster alias are one person, not ambiguous.
  signedIn = true
  players[0]!.display_name = account.display_name
  assert.equal((await resolvePlayerProfile('jansuda-k')).padelPlayerId, playerId)
  players.push({ id: otherId, display_name: account.display_name, profile_id: otherId, line_user_id: 'other' })
  assert.equal((await resolvePlayerProfile('jansuda-k')).padelPlayerId, null)
  assert.equal(await resolvePlayerRouteId({ displayName: account.display_name }), null)
  assert.equal((await resolvePlayerProfile(playerId)).padelPlayerId, playerId, 'ID route remains stable with duplicate names')
  assert.ok(rpcCalls.every(name => name === 'get_player_profile'))
  console.log('Player identity checks passed: aliases, login states, navigation, coach target, ambiguous names, no writes.')
} finally {
  supabase.from = originalFrom
  supabase.rpc = originalRpc
  globalThis.fetch = originalFetch
}
