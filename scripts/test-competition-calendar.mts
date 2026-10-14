import assert from 'node:assert/strict'
import { clubCompetitionDay, competitionWeekDays, shiftCalendarDay } from '../src/lib/competitionCalendar'

// A visitor west of Thailand must see the competition on the club's day.
assert.equal(clubCompetitionDay('2026-10-13T18:30:00Z'), '2026-10-14')
assert.equal(clubCompetitionDay(null), null)
assert.equal(clubCompetitionDay('invalid'), null)
assert.deepEqual(competitionWeekDays('2026-10-18'), [
  '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
])
assert.equal(competitionWeekDays('2027-01-01')[0], '2026-12-28')
assert.equal(shiftCalendarDay('2024-03-01', -1), '2024-02-29')
assert.equal(shiftCalendarDay('2026-12-28', 7), '2027-01-04')
console.log('Competition calendar: club timezone, invalid dates, Sunday, year and leap-day boundaries passed')
