import assert from 'node:assert/strict';
import test from 'node:test';
import {calendarForRole, preserveOwnerBookingFields} from '../server/booking/calendar-access.mjs';

const padel = 'success-padel-bookings';
const pilates = 'success-pilates-bookings';
const booked = {id:'lesson', customer:'Fixture', date:'2026-12-01', time:'12:00', court:'Court 4'};
const sensitive = {coachPayoutAmount:700, salesBilled:1200, salesReceipts:[{amount:1200}]};

test('Front desk receives editable bookings and cancellation history without owner fields', () => {
  const stored = {...booked, ...sensitive};
  const snapshot = {revision:3, records:{
    [padel]:[stored],
    [pilates]:[{...stored, room:'Room 1'}],
    lessonCancellations:[{...stored, reason:'Customer unavailable'}],
    courtCancellations:[stored],
  }, competitionBlocks:[{court:'Court 3'}]};
  const visible = calendarForRole(snapshot, 'front_desk');
  assert.deepEqual(visible.records[padel], [booked]);
  assert.deepEqual(visible.records[pilates], [{...booked, room:'Room 1'}]);
  assert.deepEqual(visible.records.lessonCancellations, [{...booked, reason:'Customer unavailable'}]);
  assert.deepEqual(visible.records.courtCancellations, [booked]);
  assert.deepEqual(visible.competitionBlocks, snapshot.competitionBlocks);
  assert.deepEqual(calendarForRole(snapshot, 'owner'), snapshot);
  assert.equal(snapshot.records[padel][0].coachPayoutAmount, sensitive.coachPayoutAmount);
});

test('Rescheduling through front desk preserves the existing owner ledger', () => {
  const previous = [{...booked, ...sensitive}];
  const moved = {...booked, time:'13:00'};
  const next = {...booked, id:'new-lesson', time:'14:00'};
  assert.deepEqual(preserveOwnerBookingFields(padel, previous, [moved, next]), [
    {...moved, ...sensitive}, next,
  ]);
});

test('Editing a legacy booking preserves owner fields when its identity is unchanged', () => {
  const legacy = {...booked};
  delete legacy.id;
  const paid = {...legacy, paid:true};
  assert.deepEqual(preserveOwnerBookingFields(padel, [{...legacy, ...sensitive}], [paid]), [
    {...paid, ...sensitive},
  ]);
});
