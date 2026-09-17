import test from 'node:test'
import assert from 'node:assert/strict'
import { competitionInvitePath, competitionInviteUrl, selectInvitedCompetition } from '../src/lib/competitionInviteLink.ts'

const id = '9df4f70a-2532-4f11-9a6d-013ab7110c25'
test('shared links always use the public domain and permanent competition code', () => {
  assert.equal(competitionInviteUrl(id), `https://successpadel.app/competitive?competition=${id}`)
  assert.equal(new URL(competitionInviteUrl(id)).searchParams.get('competition'), id)
  assert.equal(competitionInvitePath('test&view=past'), '/competitive?competition=test%26view%3Dpast')
})

test('select the exact event independent of date, title, level and roster order', () => {
  const event = {id, title: 'Changed title', status: 'complete', level: 'Intermediate'}
  const rows = [{id: 'another-event', status: 'current'}, event]
  assert.deepEqual(selectInvitedCompetition(rows, id), [event])
  assert.deepEqual(selectInvitedCompetition(rows, id.toUpperCase()), [event])
  assert.deepEqual(selectInvitedCompetition(rows.reverse(), id), [event])
})

test('unknown and empty invitation codes never show a different event', () => {
  assert.deepEqual(selectInvitedCompetition([{id}], 'unknown'), [])
  assert.deepEqual(selectInvitedCompetition([{id}], ''), [])
})
