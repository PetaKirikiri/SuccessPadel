// Guest navigation uses the same calendars, date controls and shop renderer as staff.
if (bookingGuest) {
  const publicSections = {padel:'dashboard', pilates:'pilates', shop:'shop'};
  function showGuestSection() {
    const hash = location.hash.slice(1);
    const section = Object.hasOwn(publicSections,hash) ? publicSections[hash] : 'dashboard';
    const button = sidebar.querySelector('[data-section="'+section+'"]');
    selectStaffSection(button);
    if (section === 'shop') renderShop();
    toolbar();
  }
  for (const [hash, section] of Object.entries(publicSections)) {
    const button = sidebar.querySelector('[data-section="'+section+'"]');
    button.addEventListener('click', () => {
      if (location.hash !== '#'+hash) history.pushState(null, '', '#'+hash);
      toolbar();
    });
  }

  const dialog = document.createElement('dialog');
  dialog.className='modal-back booking-dialog guest-reservation';
  dialog.setAttribute('aria-labelledby','guest-heading');
  dialog.innerHTML='<form class="modal compact-booking"><button type="button" class="close" aria-label="Close">×</button><h2 id="guest-heading">Make a booking</h2><p class="slot-context"></p><div class="guest-times"></div><label class="field" data-service>Booking type<select name="service"></select></label><label class="field" data-name>Your name<input name="customer" required maxlength="80" autocomplete="name"></label><output role="status"></output><button class="primary" type="submit">Confirm booking</button></form>';
  document.body.append(dialog);
  const form=dialog.querySelector('form'), times=dialog.querySelector('.guest-times');
  const status=form.querySelector('output'), submit=form.querySelector('[type=submit]');
  let selected, sending=false, requestId, selectionKey;
  const calendars={
    padel:{grid:courtCalendar,date:day,places:courtNames,draw},
    pilates:{grid:pGrid,date:pDay,places:rooms.map(room=>pilatesRoomLabels[room]),draw:pDraw}
  };
  const activeSport=()=>pilates.classList.contains('active')?'pilates':'padel';
  const timeLabel=m=>clockLabel(String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'));
  function label(sport,slot) {
    return calendars[sport].places[slot.resource-1]+' · '+timeLabel(slot.minute)+' · '+slot.duration+' min';
  }
  function view(sport,slot) {
    const cal=calendars[sport];
    selected=slot?{sport,date:cal.date.value,slot}:null;
    form.querySelector('h2').textContent='Make a booking';
    form.querySelector('p').textContent=[bookingDateDisplay.format(new Date(cal.date.value+'T00:00:00Z')),slot&&label(sport,slot)].filter(Boolean).join(' · ');
    status.textContent='';
    times.replaceChildren();
    times.hidden=!!slot;
    form.querySelector('[data-name]').hidden=!slot;
    submit.hidden=!slot;
    const choices=slot ? cal.slots.filter(s=>s.resource===slot.resource && s.minute===slot.minute) : [];
    form.elements.service.replaceChildren(...choices.map((s,i)=>{
      const profile=coachProfiles[s.coach];
      const title=s.coach?[s.coach,profile?.languages,profile?.levels].filter(Boolean).join(' · '):
        s.kind==='play'?'Normal play':pilatesNames[s.kind];
      return new Option(title,i);
    }));
    form.querySelector('[data-service]').hidden=choices.length<=1;
    form.elements.service.onchange=()=>{selected.slot=choices[Number(form.elements.service.value)];};
    if (!slot) {
      const displayed=new Set();
      for(const s of cal.slots??[]) {
        const key=s.resource+'-'+s.minute;
        if(displayed.has(key))continue;
        displayed.add(key);
        const button=memberNode('button',label(sport,s),'secondary'); button.type='button';
        button.onclick=()=>view(sport,s); times.append(button);
      }
      if (!times.childElementCount) status.textContent='No available times on this date.';
    }
    if (!dialog.open) dialog.showModal();
    if (slot) form.elements.customer.focus();
  }
  dialog.querySelector('.close').onclick=()=>{if(!sending)dialog.close();};
  dialog.addEventListener('cancel',event=>{if(sending)event.preventDefault();});
  dialog.addEventListener('close',()=>{form.reset();selectionKey=null;});
  form.onsubmit=async event=>{
    event.preventDefault();
    if (!selected||sending)return;
    const {sport,date,slot}=selected;
    const data={activity:sport,date,resource:slot.resource,minute:slot.minute,kind:slot.kind,coach:slot.coach,name:form.elements.customer.value.trim()};
    const key=JSON.stringify(data);
    if (selectionKey!==key) {selectionKey=key;requestId=crypto.randomUUID();}
    sending=true;submit.disabled=true;form.elements.service.disabled=true;form.elements.customer.readOnly=true;
    try {
      const response=await fetch('/api/booking-guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,id:requestId})});
      const result=await response.json();
      if(!response.ok){
        if(response.status===409){await refresh(sport);view(sport,null);}
        throw Error(result.error||'Could not save booking. Try again.');
      }
      if(result.reference!==requestId)throw Error('Confirmation unavailable. Try again.');
      selected=null;
      form.querySelector('h2').textContent='Booking confirmed';
      form.querySelector('[data-name]').hidden=form.querySelector('[data-service]').hidden=submit.hidden=true;
      status.textContent='Reference '+result.reference.slice(0,8).toUpperCase();
      void refresh(sport);
    } catch(err){status.textContent=err instanceof TypeError?'Connection lost. Try again.':err.message;}
    finally {sending=false;submit.disabled=false;form.elements.service.disabled=false;form.elements.customer.readOnly=false;}
  };
  const book=memberNode('button','Make a booking','primary');
  book.type='button';
  book.onclick=async()=>{
    const sport=activeSport(),cal=calendars[sport];
    if(cal.loaded!==cal.date.value && !(await refresh(sport)))return;
    view(sport,null);
  };
  const feedback=memberNode('output','','guest-calendar-status');
  feedback.setAttribute('role','status');
  function paint(sport){
    const cal=calendars[sport], grid=cal.grid;
    const cellsBySlot=new Map();
    for (const slot of cal.slots??[]) {
      const key=slot.resource+'-'+slot.minute;
      if (!cellsBySlot.has(key))cellsBySlot.set(key,slot);
    }
    const list=grid.querySelectorAll('.calendar-row');
    list.forEach((row,index)=>{
      if(index%2){row.hidden=true;return;}
      const minute=minutes(rows[index]);
      row.firstElementChild.textContent=timeLabel(minute);
      row.querySelectorAll('.calendar-cell').forEach((cell,column)=>{
        const slot=cellsBySlot.get(column+1+'-'+minute);
        cell.disabled=!slot; cell.textContent=slot?'Book':'';
        cell.removeAttribute('data-slot-time');
        cell.setAttribute('aria-label',slot?'Book '+label(sport,slot):cal.places[column]+' '+timeLabel(minute)+' unavailable');
        cell.onclick=slot?()=>view(sport,slot):null;
      });
    });
    if(sport===activeSport())feedback.textContent=cal.error||'';
  }
  async function refresh(sport) {
    const cal=calendars[sport],date=cal.date.value,seq=cal.seq=(cal.seq||0)+1;
    const stale=cal.loaded!==date;
    if (stale){cal.slots=[];cal.loaded=null;cal.error='';paint(sport);}
    try {
      const response=await fetch('/api/booking-guest?'+new URLSearchParams({activity:sport,date}),{cache:'no-store'});
      if(!response.ok)throw Error();
      const slots=await response.json();
      if(seq!==cal.seq || date!==cal.date.value)return false;
      slots.sort((a,b)=>a.minute-b.minute || a.resource-b.resource || Number(['play','private'].includes(b.kind))-Number(['play','private'].includes(a.kind)));
      cal.slots=slots;cal.loaded=date;cal.error='';paint(sport);return true;
    } catch{
      if(seq===cal.seq){cal.loaded=null;cal.slots=[];cal.error='Calendar unavailable. Select Make a booking to retry.';paint(sport);}
      return false;
    }
  }
  function render(sport){
    calendars[sport].draw();paint(sport);void refresh(sport);
  }
  draw=()=>render('padel');pDraw=()=>render('pilates');
  for (const [sport,cal] of Object.entries(calendars)) {
    cal.date.min=bangkokToday();
    cal.date.onchange=()=>{if(!cal.date.value||cal.date.value<cal.date.min)cal.date.value=cal.date.min;render(sport);};
  }
  function toolbar(){
    const shop=document.getElementById('shop').classList.contains('active');
    book.hidden=feedback.hidden=shop;
    if(!shop)void refresh(activeSport());
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)toolbar();});
  const signIn = memberNode('a',null,'booking-profile-trigger');
  signIn.setAttribute('aria-label','Sign in');
  signIn.title='Sign in';
  signIn.append(bookingIcon('person'));
  signIn.href = '/booking/?staff=1';
  tools.replaceChildren(book,feedback,signIn);
  administrationNavigation.setAttribute('aria-label','Shop');
  for (const element of searchBar.querySelectorAll('input[type=search], .board-results, form')) element.remove();
  document.body.dataset.bookingGuest = '';
  showGuestSection();
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
