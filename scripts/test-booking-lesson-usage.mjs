import assert from 'node:assert/strict';
import test from 'node:test';
import {summarizeLessonUsage} from '../public/booking/lesson-usage.mjs';

test('lesson usage excludes future, malformed and demo bookings and counts late cancellations separately', () => {
  const lesson = {packageId:'package', date:'2026-11-25', time:'09:00', duration:90};
  const rows = summarizeLessonUsage({
    packages:[{id:'package', memberId:'member', kind:'padel5'}],
    bookings:[lesson, {...lesson, time:'invalid'}, {...lesson, time:'18:00'}, {...lesson, preview:true}],
    cancellations:[{...lesson, late:true}, {...lesson, late:false}],
    customers:[{id:'member', name:'Fixture customer'}],
    courseName:kind => kind,
    from:'2026-11-25',
    to:'2026-11-25',
    now:Date.parse('2026-11-25T12:00:00+07:00'),
  });
  assert.deepEqual(rows,[{customer:'Fixture customer', course:'padel5', lessons:1, minutes:90, late:1}]);
});
