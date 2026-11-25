import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html = readFileSync(new URL('../public/booking/index.html', import.meta.url), 'utf8');
const date = '2026-11-24';
const window = { coach: 'Peta', date, time: '21:00', duration: 60 };

for (const court of ['Court 3', 'Court 4']) {
  test('Lesson on ' + court + ' takes one court and one package credit', () => {
    const bookings = [];
    const ctx = vm.createContext({
      calendarDataset:null, coachList: ['Peta'], coachingCourts: ['Court 3', 'Court 4'], closingMinute: 1320,
      rows: ['21:00'], availabilityKey: 'availability',
      storedRows: key => key === 'availability' ? [window] : key === 'success-padel-bookings' ? bookings : [],
      minutes: time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
    });
    for (const name of ['bookingOccursOn', 'eligibleCoaches', 'availableLessonTimes', 'packageSessions', 'usedPackage', 'remainingPackage']) {
      const body = html.match(new RegExp('function ' + name + '\\([^]*?\\}(?=function |\\n(?:function |const |let |$)|\\n\\n)'));
      assert.ok(body, name);
      vm.runInContext(body[0], ctx);
    }
    const pack = { id: 'test-package', count: 10, previousSessionsUsed: 8 };
    const options = name => ctx.availableLessonTimes(date, name, 60, bookings).length;
    assert.deepEqual(['Court 1','Court 2','Court 3','Court 4'].map(options), [0,0,1,1]);
    assert.equal(ctx.remainingPackage(pack), 2);
    bookings.push({ ...window, court, packageId: pack.id });
    assert.equal(bookings.filter(b => b.court === court).length, 1);
    assert.equal(ctx.remainingPackage(pack), 1);
    assert.deepEqual(['Court 3','Court 4'].map(options), [0,0]);
    bookings.pop();
    assert.deepEqual(['Court 3','Court 4'].map(options), [1,1]);
  });
}
