import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canonicalCompetitionInviteLocation, competitionInvitePath, competitionInviteUrl, isCompetitionInvitePath, selectInvitedCompetition } from '../src/lib/competitionInviteLink.ts'

const id = '9df4f70a-2532-4f11-9a6d-013ab7110c25'
test('September 30 short invitation opens its exact attendance page', () => {
  const eventId = 'eeea4cc0-a90c-4c19-be69-ef880852adcc'
  const shortUrl = 'https://successpadel.app/c/eeea4cc0'
  assert.equal(competitionInviteUrl(eventId), shortUrl)
  assert.equal(competitionInviteUrl(eventId.toUpperCase()), shortUrl)
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.equal(config.rewrites.find(rule => rule.source === '/c/:inviteCode').destination, '/api/competition-share?inviteCode=:inviteCode')
})
test('shared links always use the public domain and permanent competition code', () => {
  assert.equal(competitionInviteUrl(id), 'https://successpadel.app/c/9df4f70a')
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.equal(new Set(config.redirects.map(rule => rule.source)).size, config.redirects.length)
  assert.equal(config.rewrites.some(rule => rule.source === '/c/:inviteCode'), true)
  assert.equal(competitionInviteUrl('c1a8521c-0716-4294-b98f-0cfb48fdee7d'), 'https://successpadel.app/c/c1a8521c')
  assert.equal(competitionInviteUrl('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), 'https://successpadel.app/c/aaaaaaaa')
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

test('normal navigation uses the same address as sharing, for every competition', () => {
  for (const eventId of [id, 'c1a8521c-0716-4294-b98f-0cfb48fdee7d', 'eeea4cc0-a90c-4c19-be69-ef880852adcc']) {
    const path = `/c/${eventId.slice(0, 8)}`
    assert.equal(competitionInvitePath(eventId), path)
    assert.equal(competitionInviteUrl(eventId), `https://successpadel.app${path}`)
    assert.equal(canonicalCompetitionInviteLocation('/competitive', `?competition=${eventId}&preview=2`), path)
    assert.equal(canonicalCompetitionInviteLocation(path), path)
    assert.equal(canonicalCompetitionInviteLocation(path.toUpperCase().replace('/C/', '/c/') + '/'), path)
    assert.equal(isCompetitionInvitePath(path), true)
    assert.equal(isCompetitionInvitePath(`/competitions/${eventId}`), false, 'Match play remains separate')
  }
})

test('legacy review and sign-in destinations preserve their state without long identifiers', () => {
  const params = `competition=${id}&view=review&player=player-1&sp_return_to=%2Fprofile&preview=2`
  const expected = '/c/9df4f70a?view=review&player=player-1&sp_return_to=%2Fprofile#scores'
  assert.equal(canonicalCompetitionInviteLocation('/competitive/', params, '#scores'), expected)
  assert.equal(canonicalCompetitionInviteLocation('/c/9df4f70a', '?view=review&player=player-1&sp_return_to=%2Fprofile&preview=2', '#scores'), expected)
  assert.equal(canonicalCompetitionInviteLocation('/competitive'), null)
  assert.equal(canonicalCompetitionInviteLocation('/competitive', '?competition=invalid'), null)
  assert.equal(canonicalCompetitionInviteLocation('/competitive', `?competition=${id}&competition=${id}`), null)
  assert.equal(canonicalCompetitionInviteLocation('/c/9df4f70a', `?competition=${id}`), null)
})

test('short routes select exactly one full-identity row and reject prefix collisions', () => {
  const event = { id, title: 'Original event' }
  assert.deepEqual(selectInvitedCompetition([{ id: 'another-event' }, event], '9DF4F70A'), [event])
  assert.deepEqual(selectInvitedCompetition([event, { id: '9df4f70a-0000-0000-0000-000000000000' }], '9df4f70a'), [])
  assert.deepEqual(selectInvitedCompetition([event, event], id), [])
})
