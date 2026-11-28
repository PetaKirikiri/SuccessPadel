import {createHmac} from 'node:crypto';

const bookingKeys = ['success-padel-bookings', 'success-pilates-bookings', 'lessonCancellations', 'courtCancellations'];
const ownerFields = ['coachPayoutAmount', 'salesBilled', 'salesReceipts'];

export function bookingCalendarAccess(db, actor, action, details = {}) {
  const key = process.env.BOOKING_GOOGLE_SESSION_KEY;
  if (!key) throw new Error('Calendar signing unavailable');
  const request = JSON.stringify({action, actor, issued:Math.floor(Date.now() / 1000), ...details});
  const signature = createHmac('sha256', key).update('booking-staff-calendar-v1:' + request).digest('hex');
  return db.rpc('booking_staff_calendar', {request, signature});
}

function withoutOwnerFields(row) {
  const visible = {...row};
  for (const field of ownerFields) delete visible[field];
  return visible;
}

export function calendarForRole(calendar, role) {
  if (role === 'owner' || !calendar) return calendar;
  const records = {...calendar.records};
  for (const key of bookingKeys) {
    if (Array.isArray(records[key])) records[key] = records[key].map(withoutOwnerFields);
  }
  return {...calendar, records};
}

export function preserveOwnerBookingFields(key, previous, rows) {
  if (!bookingKeys.includes(key)) return rows;
  const identity = row => row.id ?? JSON.stringify([row.date, row.time, row.court ?? row.room, row.customerId ?? row.customer]);
  const byId = new Map(previous.map(row => [identity(row), row]));
  return rows.map(row => {
    const visible = withoutOwnerFields(row);
    const original = byId.get(identity(row));
    if (original) {
      for (const field of ownerFields) {
        if (Object.hasOwn(original, field)) visible[field] = original[field];
      }
    }
    return visible;
  });
}
