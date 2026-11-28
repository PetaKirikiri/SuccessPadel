export function summarizeLessonUsage({
  packages, bookings, cancellations, customers, courseName,
  from, to, now, customerId = '', courseKind = '',
}) {
  const packageById = new Map(packages
    .filter(course => (!customerId || course.memberId === customerId) && (!courseKind || course.kind === courseKind))
    .map(course => [course.id, course]));
  const names = new Map(customers.map(customer => [customer.id, customer.name]));
  const summary = new Map();
  function rowFor(packageId) {
    const course = packageById.get(packageId);
    if (!course) return null;
    const key = JSON.stringify([course.memberId, course.kind]);
    if (!summary.has(key)) {
      summary.set(key, {
        customer:names.get(course.memberId) || 'Archived customer',
        course:courseName(course.kind),
        lessons:0,
        minutes:0,
        late:0,
      });
    }
    return summary.get(key);
  }
  for (const lesson of bookings) {
    if (lesson.preview || !lesson.date || lesson.date < from || lesson.date > to ||
        !Number.isFinite(lesson.duration) || lesson.duration <= 0) continue;
    const started = Date.parse(lesson.date + 'T' + lesson.time + ':00+07:00');
    if (!Number.isFinite(started) || started + lesson.duration * 60000 > now) continue;
    const row = rowFor(lesson.packageId);
    if (!row) continue;
    row.lessons++;
    row.minutes += lesson.duration;
  }
  for (const lesson of cancellations) {
    if (lesson.preview || lesson.late !== true || !lesson.date || lesson.date < from || lesson.date > to) continue;
    const row = rowFor(lesson.packageId);
    if (row) row.late++;
  }
  return [...summary.values()].sort((first, second) =>
    first.customer.localeCompare(second.customer) || first.course.localeCompare(second.course));
}
