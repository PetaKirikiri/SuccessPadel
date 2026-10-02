import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { competitionInvitePath, competitionInviteUrl, selectInvitedCompetition } from '../src/lib/competitionInviteLink.ts'

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
