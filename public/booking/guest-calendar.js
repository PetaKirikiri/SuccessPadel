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

  const calendars={
    padel:{grid:courtCalendar,date:day,places:courtNames,draw},
    pilates:{grid:pGrid,date:pDay,places:rooms,draw:pDraw}
  };
  const activeSport=()=>pilates.classList.contains('active')?'pilates':'padel';
  const feedback=memberNode('output','','guest-calendar-status');
  feedback.setAttribute('role','status');
  const timeOf=minute=>rows[(minute-420)/15];
  const attempts=new WeakMap();

  // The existing coaching picker consumes the same {time, coaches} contract for guests.
  availableLessonTimes=(date,court,length)=>{
    const cal=calendars.padel;
    if(cal.loaded!==date)return [];
    const byTime=new Map();
    for(const slot of cal.slots){
      if(slot.kind!=='coaching'||slot.resource!==courtNames.indexOf(court)+1||slot.duration!==length)continue;
      const time=timeOf(slot.minute);
      if(!byTime.has(time))byTime.set(time,[]);
      byTime.get(time).push(slot.coach);
    }
    return Array.from(byTime,([time,coaches])=>({time,coaches}));
  };

  function openSlot(sport,slot,choices){
    const time=timeOf(slot.minute);
    if(sport==='padel'){
      start(courtNames[slot.resource-1],time);
      resource.disabled=true;
      duration.disabled=true;
      bookingError(modal,'');
    }else{
      pStart(rooms[slot.resource-1],time);
      for(const option of pService.options)option.disabled=!choices.some(s=>s.kind===option.value);
      if(pService.selectedOptions[0]?.disabled)pService.value=slot.kind;
      pDuration.value=String(slot.duration);
      pDuration.disabled=true;
      pPrice();
      bookingError(pModal,'');
    }
  }

  function paint(sport){
    const cal=calendars[sport];
    if(sport==='padel' && pickingLessonTime){renderLessonCalendar();return;}
    const byStart=new Map();
    for(const slot of cal.slots??[]){
      const key=slot.resource+'-'+slot.minute;
      if(!byStart.has(key))byStart.set(key,[]);
      byStart.get(key).push(slot);
    }
    // Bind availability to the original cells. Their typography, hour labels,
    // dimensions and pointer feedback are owned by the shared renderer.
    cal.grid.querySelectorAll('.calendar-row').forEach((row,index)=>{
      const minute=minutes(rows[index-index%2]);
      row.querySelectorAll('.calendar-cell').forEach((cell,column)=>{
        const choices=byStart.get((column+1)+'-'+minute);
        const slot=choices?.[0];
        cell.disabled=!slot;
        cell.tabIndex=slot && index%2===0?0:-1;
        cell.dataset.slotTime=clockLabel(timeOf(minute));
        cell.setAttribute('aria-label',cal.places[column]+' '+cell.dataset.slotTime+(slot?'':' unavailable'));
        cell.onclick=slot?()=>openSlot(sport,slot,choices):null;
      });
    });
  }

  async function save(sport,dialog,button){
    const padel=sport==='padel';
    const date=padel?dateInput.value:pSelected.date;
    const name=padel?newCourtPlayers.value[0]:pCustomer.value.trim();
    const field=padel?newCourtPlayers.label.querySelector('input'):pCustomer;
    if(!name){bookingError(dialog,'Enter a name.');field.focus();return;}
    const data={activity:sport,date,name,resource:padel?courtNames.indexOf(resource.value)+1:rooms.indexOf(pSelected.room)+1,
      minute:minutes(padel?timeInput.value:pSelected.time),kind:padel?activity.value:pService.value,
      coach:padel&&activity.value==='coaching'?coachSelect.value:null};
    const key=JSON.stringify(data);
    if(attempts.get(dialog)?.key!==key)attempts.set(dialog,{key,id:crypto.randomUUID()});
    const {id}=attempts.get(dialog);
    button.disabled=true;
    bookingError(dialog,'');
    try{
      const response=await fetch('/api/booking-guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,id})});
      const result=await response.json();
      if(!response.ok){
        if(response.status===409)await refresh(sport);
        throw Error(result.error||'Could not save booking. Try again.');
      }
      if(result.reference!==id)throw Error('Confirmation unavailable. Try again.');
      attempts.delete(dialog);
      dialog.close();
      await refresh(sport);
      feedback.textContent='Booking confirmed · '+id.slice(0,8).toUpperCase();
    }catch(err){bookingError(dialog,err instanceof TypeError?'Connection lost. Try again.':err.message);}
    finally{button.disabled=false;}
  }
  for(const [sport,dialog,button] of [['padel',modal,courtSaveButton],['pilates',pModal,document.getElementById('p-save')]]){
    button.onclick=()=>save(sport,dialog,button);
    dialog.addEventListener('cancel',event=>{if(button.disabled)event.preventDefault();});
  }
  productChoices.querySelector('[data-product="90"]').hidden=true;
  activityChoices.addEventListener('change',()=>{
    if(activity.value==='play'){
      duration.value=(timeInput.value.endsWith(':30')?'30 min':'60 min');
      refreshPrice();
    }
    duration.disabled=true;
  });
  pCustomer.removeAttribute('list');
  // Reuse the toolbar action that opens the original form on the first free cell.
  newBookingButton.onclick=async()=>{
    if(document.getElementById('shop').classList.contains('active'))sidebar.querySelector('[data-section="dashboard"]').click();
    const sport=activeSport(),cal=calendars[sport];
    if(cal.loaded!==cal.date.value && !(await refresh(sport)))return;
    const cell=cal.grid.querySelector('.calendar-cell:enabled');
    if(cell)cell.click();else feedback.textContent='No available times on this date.';
  };
  async function refresh(sport) {
    const cal=calendars[sport],date=cal.date.value,seq=cal.seq=(cal.seq||0)+1;
    const stale=cal.loaded!==date;
    if (stale){cal.slots=[];cal.loaded=null;paint(sport);}
    try {
      const response=await fetch('/api/booking-guest?'+new URLSearchParams({activity:sport,date}),{cache:'no-store'});
      if(!response.ok)throw Error();
      const slots=await response.json();
      if(seq!==cal.seq || date!==cal.date.value)return false;
      slots.sort((a,b)=>a.minute-b.minute || a.resource-b.resource || Number(['play','private'].includes(b.kind))-Number(['play','private'].includes(a.kind)));
      cal.slots=slots;cal.loaded=date;paint(sport);return true;
    } catch{
      if(seq===cal.seq){cal.loaded=null;cal.slots=[];paint(sport);if(sport===activeSport())feedback.textContent='Calendar unavailable. Try again.';}
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
    feedback.textContent='';
    feedback.hidden=shop;
    if(!shop)void refresh(activeSport());
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)toolbar();});
  const signIn = memberNode('a',null,'booking-profile-trigger');
  signIn.setAttribute('aria-label','Sign in');
  signIn.title='Sign in';
  signIn.append(bookingIcon('person'));
  signIn.href = '/booking/?staff=1';
  tools.replaceChildren(newBookingButton,feedback,signIn);
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
