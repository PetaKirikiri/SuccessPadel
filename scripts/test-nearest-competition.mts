import assert from 'node:assert/strict'
import { nearestCompetitionId } from '../src/lib/nearestCompetition.ts'
const now = Date.parse('2026-09-23T18:30:00+07:00')
const rows = [
  { id: 'old-locked', status: 'locked', starts_at: '2026-09-18T18:00:00+07:00', ends_at: '2026-09-18T20:00:00+07:00' },
  { id: 'tonight', status: 'open', starts_at: '2026-09-23T18:00:00+07:00', ends_at: '2026-09-23T20:00:00+07:00' },
  { id: 'next', status: 'open', starts_at: '2026-09-24T18:00:00+07:00', ends_at: '2026-09-24T20:00:00+07:00' },
]
assert.equal(nearestCompetitionId(rows, now), 'tonight')
assert.equal(nearestCompetitionId(rows, Date.parse('2026-09-23T12:00:00+07:00')), 'tonight')
assert.equal(nearestCompetitionId(rows, Date.parse('2026-09-23T20:00:00+07:00')), 'next')
assert.equal(nearestCompetitionId(rows.map(r => r.id === 'tonight' ? { ...r, status: 'complete' } : r), now), 'next')
assert.equal(nearestCompetitionId(rows.slice(0, 1), now), 'old-locked')
assert.equal(nearestCompetitionId([{ id: 'date-only', status: 'open', starts_on: '2026-09-23' }], now), 'date-only')
assert.equal(nearestCompetitionId([{ id: 'draft', status: 'draft', starts_on: '2026-09-23' }, { id: 'cancelled', status: 'cancelled', starts_on: '2026-09-23' }, { id: 'bad', status: 'open', starts_at: 'invalid' }], now), null)
assert.equal(nearestCompetitionId([], now), null)
console.log('Nearest competition: 8 routing cases passed')
