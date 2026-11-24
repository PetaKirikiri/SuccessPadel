const administrationNavigation = sidebar.querySelector('.staff-nav');

administrationNavigation.prepend(customerNav);

if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
  const adminButton = document.createElement('button');
  adminButton.type = 'button';
  adminButton.className = 'booking-admin-button';
  adminButton.textContent = 'Admin';
  adminButton.setAttribute('aria-controls', 'booking-users');


  const usersButton = document.createElement('button');
  usersButton.type = 'button';
  usersButton.dataset.section = 'booking-users';
  usersButton.textContent = 'Users & access';
  administrationNavigation.append(usersButton);

  const usersPage = document.createElement('section');
  usersPage.className = 'page booking-admin-page';
  usersPage.id = 'booking-users';
  document.querySelector('.content').append(usersPage);

  usersButton.onclick = () => {
    if (bookingStaffRole !== 'owner') return;
    selectStaffSection(usersButton);
    if (usersPage.firstElementChild) return;
    const frame = document.createElement('iframe');
    frame.title = 'Users & access';
    frame.src = '/booking/users.html?v=admin-tables';
    usersPage.append(frame);
  };
  adminButton.onclick = () => {
    if (bookingStaffRole !== 'owner') return;
    staffAccount.open = false;
    usersButton.click();
  };

  staffAccountActions.prepend(adminButton);
}

for (const [section, input] of [['dashboard', day], ['pilates', pDay]]) {
  const dateControls = input.closest('.booking-week-toolbar');
  dateControls.dataset.calendarControls = section;
  searchBar.prepend(dateControls);
}

const bookingDateDisplay = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
for (const [input, calendar] of [[day, document.getElementById('court-calendar')], [pDay, pGrid]]) {
  const field = document.createElement('span');
  field.className = 'booking-date-field';
  const display = document.createElement('span');
  display.setAttribute('aria-hidden', 'true');
  input.before(field);
  field.append(display, input);

  const updateDisplay = () => {
    display.textContent = input.value
      ? bookingDateDisplay.format(new Date(input.value + 'T00:00:00Z'))
      : 'Booking date';
  };
  input.addEventListener('input', updateDisplay);
  input.addEventListener('change', updateDisplay);
  new MutationObserver(updateDisplay).observe(calendar, {childList: true});
  updateDisplay();
}

function seedPreviewCompetitions() {
  if (location.hostname !== '127.0.0.1') return;
  const key = 'success-padel-bookings';
  const saved = storedRows(key);
  let changed = false;
  for (const [date, title] of [
    ['2026-11-25','Beginner Tournament · Mixed'],
    ['2026-11-26','Intermediate Competition · Mixed'],
    ['2026-11-27','Intermediate Competition · Fixed'],
  ]) {
    const legacy = saved.filter(booking => booking.eventId && booking.weeklyOngoing &&
      booking.date === date && booking.time === '18:00' && booking.duration === 120 &&
      date === '2026-11-25' && booking.customer === 'Beginner Tournament');
    for (const booking of legacy) {
      booking.customer = title;
      booking.eventType = 'competition';
      changed = true;
    }
    if (saved.some(booking => booking.eventId && booking.date === date && booking.customer === title)) continue;
    const series = {date, weeklyOngoing:true};
    const conflict = saved.some(booking => courtNames.includes(booking.court) &&
      minutes(booking.time) < 1200 && minutes(booking.time) + booking.duration > 1080 &&
      (bookingOccursOn(booking,date) || bookingOccursOn(series,booking.date)));
    if (conflict) continue;
    const eventId = 'preview-competition-' + date;
    for (const court of courtNames) {
      saved.push({...series,eventId,eventType:'competition',eventRepeat:'weekly',
        eventEnd:'20:00',activity:'event',customer:title,court,time:'18:00',duration:120,price:0,preview:true});
    }
    changed = true;
  }
  for (const [date, court, time, duration, customer, coach, product, paid, price, paymentMethod] of [
    ['2026-11-26','Court 1','08:30',90,'Ben',null,null,true,1200,'test-qr'],
    ['2026-11-26','Court 3','10:30',60,'Maya','David','normal-coaching',true,2000,'test-card'],
    ['2026-11-26','Court 4','15:00',90,'Pim','Bia','coaching-match',false,2400],
    ['2026-11-27','Court 2','09:00',60,'Lek',null,null,false,800],
    ['2026-11-27','Court 3','11:00',60,'Narin T.','Tong','normal-coaching',true,2000,'test-card'],
    ['2026-11-27','Court 4','14:30',90,'Anan S.','Neung','coaching-match',false,2400],
  ]) {
    const example = saved.find(booking => booking.preview && !booking.eventId &&
      booking.date === date && booking.court === court && booking.time === time &&
      booking.duration === duration && booking.customer === customer && booking.coach === coach &&
      booking.price == null);
    const payment = paid ? {
      paidAmount:price, paymentMethod, paidBy:customer, paidAt:date+'T'+time+':00+07:00',
    } : {};
    if (example) {
      Object.assign(example,{price,...(example.paid && !example.paidAt ? payment : {})});
      changed = true;
      continue;
    }
    const start = minutes(time), end = start + duration;
    if (saved.some(booking => bookingOccursOn(booking,date) &&
      (booking.court === court || (coach && booking.coach === coach)) &&
      minutes(booking.time) < end && minutes(booking.time) + booking.duration > start)) continue;
    saved.push({date,court,time,duration,customer,coach,product,paid,price,...payment,
      activity:coach?'coaching':'play',membership:'Non-member',preview:true});
    changed = true;
  }
  for (const booking of saved) {
    if (booking.date !== '2026-11-25' || !booking.preview || booking.eventId ||
        booking.paidAt || booking.splitPayments?.length || !bookingIsPaid(booking) ||
        !Number.isFinite(booking.price) || booking.price <= 0 || !booking.paymentMethod) continue;
    booking.paidAt = booking.date+'T'+booking.time+':00+07:00';
    booking.paidBy ||= booking.customer;
    booking.paidAmount ??= booking.price;
    changed = true;
  }
  if (changed) {
    localStorage.setItem(key,JSON.stringify(saved));
    refreshBookingCalendars();
  }
}
seedPreviewCompetitions();

function seedPreviewClinic() {
  if (!['127.0.0.1', 'localhost'].includes(location.hostname)) return;
  const key = 'success-padel-bookings';
  const bookings = storedRows(key);
  const clinic = {
    eventId: 'preview-beginner-clinic', eventRepeat: 'weekly', weeklyOngoing: true,
    date: '2026-11-28', time: '14:00', duration: 60, eventEnd: '15:00',
    court: 'Court 4', customer: 'Padel Clinic · Beginners · Bia · 3 players',
    eventCoach: 'Bia', activity: 'event', preview: true,
  };
  if (bookings.some(booking => booking.eventId === clinic.eventId ||
    (booking.eventId && booking.date === clinic.date && booking.customer === clinic.customer))) return;
  const legacy = bookings.find(booking => booking.eventId && booking.weeklyOngoing &&
    booking.date === clinic.date && booking.time === clinic.time && booking.duration === clinic.duration &&
    booking.court === 'Court 1' && booking.customer === 'Padel Clinic · Beginners · Beer · 3 players');
  const conflict = bookings.some(booking => booking !== legacy && booking.court === clinic.court &&
    minutes(booking.time) < 900 && minutes(booking.time) + booking.duration > 840 &&
    (bookingOccursOn(booking, clinic.date) || bookingOccursOn(clinic, booking.date)));
  if (conflict) return;
  if (legacy) Object.assign(legacy, clinic, {eventId: legacy.eventId});
  else bookings.push(clinic);
  localStorage.setItem(key, JSON.stringify(bookings));
  refreshBookingCalendars();
}
seedPreviewClinic();
