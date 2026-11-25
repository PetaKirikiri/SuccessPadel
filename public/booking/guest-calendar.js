// Guest navigation uses the same calendars, date controls and shop renderer as staff.
if (bookingGuest) {
  const publicSections = {padel:'dashboard', pilates:'pilates', shop:'shop'};
  function showGuestSection() {
    const hash = location.hash.slice(1);
    const section = Object.hasOwn(publicSections,hash) ? publicSections[hash] : 'dashboard';
    const button = sidebar.querySelector('[data-section="'+section+'"]');
    selectStaffSection(button);
    if (section === 'shop') renderShop();
  }
  for (const [hash, section] of Object.entries(publicSections)) {
    const button = sidebar.querySelector('[data-section="'+section+'"]');
    button.addEventListener('click', () => {
      if (location.hash !== '#'+hash) history.pushState(null, '', '#'+hash);
    });
  }

  // Guests request a time through the club. No booking records are fetched or edited.
  const requestDialog = document.createElement('dialog');
  requestDialog.className = 'modal-back booking-dialog';
  requestDialog.setAttribute('aria-labelledby','guest-request-title');
  requestDialog.innerHTML = '<form method="dialog" class="modal compact-booking"><button class="close" aria-label="Close">×</button><h2 id="guest-request-title"></h2><p class="slot-context"></p><div class="modal-actions"><a class="primary" data-request></a><a class="secondary" data-coaching>Ask about coaching</a></div></form>';
  document.body.append(requestDialog);
  function requestTime(place, selectedDate, time, coaching) {
    const label = place+' · '+bookingDateDisplay.format(new Date(selectedDate+'T00:00:00Z'))+' · '+clockLabel(time);
    requestDialog.querySelector('h2').textContent = place;
    requestDialog.querySelector('p').textContent = label.slice(place.length+3);
    const request = requestDialog.querySelector('[data-request]');
    request.textContent = 'Request on WhatsApp';
    const messageLink = text => 'https://wa.me/66800579093?text='+encodeURIComponent(text);
    request.href = messageLink('I’d like to request '+label+'. Is this time available?');
    const coach = requestDialog.querySelector('[data-coaching]');
    coach.hidden = !coaching;
    coach.href = messageLink('Is coaching available on '+label+'?');
    requestDialog.showModal();
  }
  function guestCells(grid, date, places, padel) {
    const now = Date.now();
    const blockedPast = date < bangkokToday();
    grid.querySelectorAll('.calendar-row').forEach((row,index) => {
      const hour = rows[index].slice(0,2);
      const time = hour + (index%4 < 2 ? ':00' : ':30');
      row.querySelectorAll('.calendar-cell').forEach((cell,column)=>{
        const place = places[column];
        const start = Date.parse(date+'T'+time+':00+07:00');
        cell.disabled = !Number.isFinite(start) || blockedPast || start <= now ||
          (!padel && minutes(time)+45>closingMinute);
        cell.tabIndex = index%2 ? -1 : 0;
        cell.dataset.slotTime = clockLabel(time);
        cell.setAttribute('aria-label', 'Request '+place+' at '+clockLabel(time));
        cell.onclick = () => requestTime(place,date,time,padel && column>=2);
      });
    });
  }
  const staffCourtDraw = draw, staffPilatesDraw = pDraw;
  draw = () => { staffCourtDraw(); guestCells(courtCalendar,day.value,courtNames,true); };
  pDraw = () => { staffPilatesDraw(); guestCells(pGrid,pDay.value,rooms.map(room=>pilatesRoomLabels[room]),false); };
  for (const [field,render] of [[day,draw],[pDay,pDraw]]) {
    field.min = bangkokToday();
    field.onchange = () => {
      if (!field.value || field.value < field.min) field.value = field.min;
      render();
    };
  }
  const signIn = memberNode('a','Staff sign-in','secondary');
  signIn.href = '/booking/?staff=1';
  tools.replaceChildren(signIn);
  administrationNavigation.setAttribute('aria-label','Shop');
  for (const element of searchBar.querySelectorAll('input[type=search], .board-results, form')) element.remove();
  document.body.dataset.bookingGuest = '';
  showGuestSection();
  draw();
  pDraw();
  staffAccess.hidden = true;
  document.body.removeAttribute('data-booking-locked');
  window.addEventListener('hashchange',showGuestSection);

  async function restoreStaffEntry() {
    const switchToStaff = () => {
      const target = new URL(location.href);
      target.searchParams.set('staff','1');
      location.replace(target.href);
    };
    try {
      const session = await staffRequest('session');
      if (['owner','front_desk'].includes(session.role)) switchToStaff();
    } catch (error) {
      if (error.returning || error.mfa) switchToStaff();
    }
  }
  restoreStaffEntry();
}
