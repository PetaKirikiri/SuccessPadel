import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { competitionInvitePath, competitionInviteUrl, selectInvitedCompetition } from '../src/lib/competitionInviteLink.ts'

const id = '9df4f70a-2532-4f11-9a6d-013ab7110c25'
test('shared links always use the public domain and permanent competition code', () => {
  assert.equal(competitionInviteUrl(id), 'https://successpadel.app/c/9df4f70a')
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const redirect = config.redirects.find(rule => rule.source === new URL(competitionInviteUrl(id)).pathname)
  assert.equal(redirect.permanent, true)
  assert.equal(redirect.destination, competitionInvitePath(id))
  assert.equal(new Set(config.redirects.map(rule => rule.source)).size, config.redirects.length)
  assert.equal(new URL(redirect.destination, 'https://successpadel.app').searchParams.get('competition'), id)
  assert.equal(competitionInviteUrl('another-event'), 'https://successpadel.app/competitive?competition=another-event')
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
