import assert from 'node:assert/strict'
import { skillRating, observationRating } from '../src/lib/coachSkillRatings'
import { loadCoachEntries, type CoachEntry, type CoachObservation } from '../src/lib/coachFeedback'
import { supabase } from '../src/lib/supabaseClient'

const note = (score?: number | null, skill = 'Net position'): CoachObservation => ({
  category: 'positioning', skill, kind: 'observation', observation: 'Test only', next_step: '', evidence: 'Test only',
  ...(score === undefined ? {} : { rating: score, rating_source: score === null ? null : 'estimated' as const }),
})
const entry = (id: string, ...notes: CoachObservation[]): CoachEntry => ({
  id, player_id: 'test-player', created_at: '2026-09-23T12:00:00Z', transcript: 'Test only',
  feedback: { observations: notes }, coach: null,
})
const first = entry('first', note(4))
const second = entry('second', note(8), note(6, 'Recovery position'))
const legacy = entry('legacy', note())
assert.equal(skillRating([first, second, legacy], 'positioning').score, 5.5)
assert.equal(skillRating([first, second], 'positioning', 'Net position').score, 6)
assert.equal(skillRating([first, second], 'attack').score, null)
assert.equal(skillRating([legacy, entry('vague', note(null))], 'positioning').score, null)
assert.equal(skillRating([first, first, second], 'positioning').score, 5.5)
assert.equal(skillRating([second], 'positioning').score, 7, 'Removing a note recalculates the average')
for (const invalid of [0, 11, 6.2, NaN]) assert.equal(observationRating(note(invalid)), null)
assert.equal(observationRating({ ...note(7), rating_source: null }), null)

// No network or live writes. Exercise >100 rows with timestamp ties and new inserts.
const originalFrom = supabase.from, originalRpc = supabase.rpc, originalFetch = globalThis.fetch
globalThis.fetch = async () => { throw new Error('Unexpected network in coach ratings tests') }
let history = Array.from({ length: 205 }, (_, i) => ({
  ...entry(String(1000 - i).padStart(4, '0'), note(i < 100 ? 8 : 4)), coach_id: 'test-coach', status: 'complete',
  competition_id: i % 2 === 0 ? 'event-one' : 'event-two',
}))
let pages = 0, attributionCalls = 0, fail = false
supabase.from = ((table: string) => {
  assert.equal(table, 'player_coach_observations')
  let result = history.slice(), limit = 0
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      result = result.filter(row => row[key as keyof typeof row] === value); return query
    },
    order: () => query,
    limit: (count: number) => { limit = count; return query },
    or: (filter: string) => {
      const cursor = /id\.lt\.([^)]*)/.exec(filter)?.[1]
      assert.ok(cursor)
      result = result.filter(row => row.id < cursor); return query
    },
    then: (resolve: (value: unknown) => unknown) => {
      pages++
      if (pages === 1) history = [{ ...entry('9999', note(10)), coach_id: 'test-coach', status: 'complete', competition_id: 'event-two' }, ...history]
      return Promise.resolve({ data: result.slice(0, limit), error: fail ? { message: 'Failed page' } : null }).then(resolve)
    },
  }
  return query
}) as typeof supabase.from
supabase.rpc = (async () => { attributionCalls++; return { data: { display_name: 'Test coach' }, error: null } }) as typeof supabase.rpc
try {
  const loaded = await loadCoachEntries('test-player')
  assert.equal(loaded.length, 205)
  assert.equal(new Set(loaded.map(row => row.id)).size, 205)
  assert.equal(pages, 3)
  assert.equal(attributionCalls, 1)
  assert.equal(skillRating(loaded, 'positioning').score, 6)
  assert.equal(loaded[0].coach?.display_name, 'Test coach')
  const eventNotes = await loadCoachEntries('test-player', 'event-one')
  assert.equal(eventNotes.length, 103, 'Review includes only notes explicitly linked to the event')
  assert.equal((await loadCoachEntries('test-player', 'different-event')).length, 0)
  fail = true
  await assert.rejects(loadCoachEntries('test-player'), /Could not load/)
  console.log('Coach rating checks passed: cumulative averages, history, deletion, missing scores, 205-row pagination, attribution, failure handling.')
} finally {
  supabase.from = originalFrom; supabase.rpc = originalRpc; globalThis.fetch = originalFetch
}
