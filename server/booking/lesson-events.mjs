import { randomUUID } from 'node:crypto';

const courts = 'success-padel-bookings';
const packages = 'success-booking-packages-v1';
const cutoff = 12 * 60 * 60 * 1000;
const week = 7 * 24 * 60 * 60 * 1000;
const validCourts = new Set(['Court 1', 'Court 2', 'Court 3', 'Court 4']);
const coachingCourts = new Set(['Court 3', 'Court 4']);
const slotFields = ['date', 'time', 'duration', 'court', 'coach', 'weeklyOngoing'];
const minutes = time => typeof time === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)
  ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  : NaN;

function isLesson(booking) {
  return booking.activity === 'coaching' || Boolean(booking.coach && !booking.eventId);
}

function validDate(date) {
  const value = Date.parse(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value) &&
    new Date(value).toISOString().slice(0, 10) === date;
}

function occursOn(booking, date) {
  if (booking.date === date) return true;
  const difference = Date.parse(date) - Date.parse(booking.date);
  return booking.weeklyOngoing === true && difference > 0 && difference % week === 0;
}

function overlaps(first, second) {
  if (!occursOn(first, second.date) && !occursOn(second, first.date)) return false;
  const start = minutes(first.time);
  const otherStart = minutes(second.time);
  return start < otherStart + Number(second.duration) && otherStart < start + Number(first.duration);
}

function sameSlot(first, second) {
  return isLesson(first) === isLesson(second) && Boolean(first.eventId) === Boolean(second.eventId) &&
    slotFields.every(field => (first[field] ?? null) === (second[field] ?? null));
}

function previousBooking(booking, prior, priorById) {
  if (booking.id) return priorById.get(booking.id);
  return prior.find(old => !old.id && old.eventId === booking.eventId && sameSlot(old, booking));
}

function coachAvailable(booking, windows) {
  const start = minutes(booking.time);
  let coveredUntil = start;
  const sameDayWindows = windows
    .filter(window => window.date === booking.date && window.coach === booking.coach)
    .sort((first, second) => minutes(first.time) - minutes(second.time));
  for (const window of sameDayWindows) {
    const opening = minutes(window.time);
    if (opening > coveredUntil) break;
    if (Number.isFinite(window.duration) && window.duration > 0) {
      coveredUntil = Math.max(coveredUntil, opening + window.duration);
    }
  }
  return coveredUntil >= start + booking.duration;
}

function validateSlot(booking, reservations, windows) {
  const start = minutes(booking.time);
  const duration = booking.duration;
  if (!validDate(booking.date) || !validCourts.has(booking.court) ||
      !Number.isInteger(start) || !Number.isInteger(duration) || duration <= 0 ||
      start < 7 * 60 || start + duration > 22 * 60) {
    throw Error('Choose a valid court, date and time.');
  }
  if (isLesson(booking)) {
    if (!booking.id || !booking.coach || !coachingCourts.has(booking.court) ||
        ![60, 90].includes(duration) || start % 15 !== 0 || !coachAvailable(booking, windows)) {
      throw Error('Lesson time unavailable.');
    }
  } else if (!booking.eventId && (duration !== 60 || start % 60 !== 0)) {
    throw Error('Choose a full hour on the calendar.');
  }
  if (reservations.some(other => other !== booking &&
      (other.court === booking.court || (booking.coach && other.coach === booking.coach)) &&
      overlaps(booking, other))) {
    throw Error(isLesson(booking) ? 'Lesson time unavailable.' : 'Court already booked.');
  }
}

export function applyLessonChanges(records, next, now = Date.now(), cancellation, competitionBlocks = []) {
  const prior = records[courts] ?? [];
  const priorById = new Map(prior.filter(booking => booking.id).map(booking => [booking.id, booking]));
  const nextIds = next.map(booking => booking?.id).filter(Boolean);
  if (new Set(nextIds).size !== nextIds.length) throw Error('Duplicate booking.');
  if (next.some(booking => !booking || typeof booking !== 'object' || Array.isArray(booking))) {
    throw Error('Invalid booking.');
  }
  const changes = [];
  const cancellations = [...(records.lessonCancellations ?? [])];
  const output = {...records, [courts]:next, lessonCancellations:cancellations};
  if (cancellation !== undefined) {
    const booking = priorById.get(cancellation?.id);
    const reason = cancellation?.reason;
    if (!booking || nextIds.includes(booking.id) || typeof reason !== 'string' ||
        !reason.trim() || reason.length > 500) throw Error('Invalid cancellation.');
    if (!isLesson(booking)) {
      output.courtCancellations = [...(records.courtCancellations ?? []),
        {...booking, reason:reason.trim(), cancelledAt:new Date(now).toISOString()}];
    }
  }

  const lessonIds = new Set(next.filter(isLesson).map(booking => booking.id).filter(Boolean));
  const packageById = new Map((records[packages] ?? []).map(pack => [pack.id, pack]));
  function balance(id) {
    if (!id) return null;
    const pack = packageById.get(id);
    if (!pack) throw Error('Package unavailable.');
    return pack.count - (pack.previousSessionsUsed || 0) - next.filter(booking => booking.packageId === id).length
      - (records['success-pilates-bookings'] ?? []).filter(booking => booking.packageId === id).length
      - cancellations.filter(booking => booking.packageId === id && booking.late).length;
  }
  for (const booking of prior) {
    if (!booking.id || !isLesson(booking) || lessonIds.has(booking.id)) continue;
    const late = Date.parse(booking.date + 'T' + booking.time + ':00+07:00') - now < cutoff;
    cancellations.push({...booking, ...(cancellation?.id === booking.id ? {reason:cancellation.reason.trim()} : {}),
      late, cancelledAt:new Date(now).toISOString()});
    changes.push({kind:'cancelled', booking, remaining:balance(booking.packageId)});
  }

  const reservations = [...next, ...competitionBlocks];
  const windows = records['success-coach-availability'] ?? [];
  for (const booking of next) {
    const previous = previousBooking(booking, prior, priorById);
    const slotChanged = !previous || !sameSlot(previous, booking);
    const packageChanged = !previous || previous.packageId !== booking.packageId ||
      previous.customerId !== booking.customerId;
    const lesson = isLesson(booking);
    const newLesson = lesson && (!previous || !isLesson(previous));
    if (newLesson && cancellations.some(item => item.id === booking.id)) throw Error('Lesson already cancelled.');
    if (slotChanged) validateSlot(booking, reservations, windows);
    if (!slotChanged && !packageChanged) continue;
    const remaining = balance(booking.packageId);
    if (booking.packageId) {
      const pack = packageById.get(booking.packageId);
      if (!lesson || !Number.isFinite(remaining) || remaining < 0 ||
          pack.memberId !== booking.customerId || !['padel5', 'padel10'].includes(pack.kind) ||
          booking.duration !== 60 || pack.purchased > booking.date || pack.expires < booking.date) {
        throw Error('Package unavailable.');
      }
    }
    if (newLesson) changes.push({kind:'booked', booking, remaining});
  }
  return {output, changes};
}
export async function sendLessonNotices(changes,enabled) {
  for(const {booking:b,kind,remaining} of changes){
    if(!enabled||b.customerId!=='padel-card-012'||b.coach!=='Peta')continue;
    const token=process.env.BOOKING_LINE_CHANNEL_ACCESS_TOKEN;
    const recipients=[process.env.BOOKING_LINE_KET_USER_ID,process.env.BOOKING_LINE_PETA_USER_ID];
    if(!token||recipients.some(id=>!/^U[0-9a-f]{32}$/i.test(id||'')))return false;
    const text='Lesson '+kind+' · '+b.customer+' with '+b.coach+' · '+b.date+' '+b.time+' (Bangkok) · '+b.court+
      (remaining===null?'':' · '+remaining+' lesson'+(remaining===1?'':'s')+' remaining.');
    const results=await Promise.allSettled(recipients.map(to=>fetch('https://api.line.me/v2/bot/message/push',{
      method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Line-Retry-Key':randomUUID()},
      body:JSON.stringify({to,messages:[{type:'text',text}]}),signal:AbortSignal.timeout(5000)
    })));
    if(results.some(r=>r.status!=='fulfilled'||!r.value.ok))return false;
  }
  return true;
}
