(() => {
  const page = document.createElement('section');
  page.id = 'events';
  page.className = 'page event-page booking-admin-page';
  page.innerHTML = `<header class="booking-page-header"><h1>Events</h1><button type="button" class="primary">New event</button></header>
    <form hidden><label>Event name<input name="title" required maxlength="100"></label>
    <label>Start date<input type="date" name="date" required></label>
    <label>Start time<select name="start" required><option value="">Select time</option></select></label>
    <label>End time<select name="end" required><option value="">Select time</option></select></label>
    <label>Repeat<select name="repeat"><option value="once">Once</option><option value="weekly">Weekly</option></select></label>
    <label hidden>Last date (optional)<input type="date" name="until"></label>
    <fieldset><legend>Courts</legend></fieldset>
    <output role="alert"></output><div><button type="button" class="secondary" name="cancel">Cancel</button> <button class="primary">Book courts</button></div></form>
    <div class="booking-data-table"><table class="events-list"><thead><tr><th>Event</th><th>Day</th><th>Frequency</th></tr></thead><tbody></tbody></table></div>`;
  document.querySelector('.content').append(page);
  const tab = document.createElement('button');
  tab.textContent = 'Events';
  tab.dataset.section = 'events';
  sidebar.querySelector('.staff-nav').append(tab);
  const form = page.querySelector('form');
  const fields = form.elements;
  const closingTime=String(Math.floor(closingMinute/60)).padStart(2,'0')+':'+String(closingMinute%60).padStart(2,'0');
  for(const time of rows)fields.start.add(new Option(clockLabel(time),time));
  function updateEndTimes(){
    const previous=fields.end.value;
    fields.end.length=1;
    for(const time of [...rows.slice(1),closingTime]){
      if(time>fields.start.value)fields.end.add(new Option(clockLabel(time),time));
    }
    if(previous>fields.start.value)fields.end.value=previous;
  }
  fields.start.onchange=updateEndTimes;
  updateEndTimes();
  const error = form.querySelector('output');
  const longDate = date => new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
  function render(){
    const body=page.querySelector('tbody');
    body.replaceChildren();
    const groups=new Map();
    for(const booking of displayedCourtBookings()){
      if(!booking.eventId)continue;
      if(!groups.has(booking.eventId))groups.set(booking.eventId,[]);
      groups.get(booking.eventId).push(booking);
    }
    const today=bangkokToday();
    const events=Array.from(groups.values(),bookings=>{
      const dates=[...new Set(bookings.map(b=>b.date))].sort();
      const ongoing=bookings.find(b=>b.weeklyOngoing);
      let date=dates.find(d=>d>=today)||dates[dates.length-1];
      if(ongoing && today>ongoing.date){
        const weeks=Math.ceil((Date.parse(today)-Date.parse(ongoing.date))/(7*86400000));
        date=dateOffset(ongoing.date,weeks*7);
      }
      return {booking:ongoing||bookings.find(b=>b.date===date),date,recurring:bookings[0].eventRepeat==='weekly'||dates.length>1};
    });
    events.sort((a,b)=>Number(a.date<today)-Number(b.date<today)||a.date.localeCompare(b.date)||a.booking.time.localeCompare(b.booking.time));
    for(const {booking,date,recurring} of events){
      const row=body.insertRow();
      const link=document.createElement('button');
      link.textContent=booking.customer;
      link.onclick=()=>{sidebar.querySelector('[data-section=dashboard]').click();day.value=date;refreshBookingCalendars()};
      row.insertCell().append(link);
      row.insertCell().textContent=longDate(date)+' · '+clockLabel(booking.time);
      row.insertCell().textContent=recurring?'Recurring · Weekly':'One-off';
    }
    if(!events.length){
      const empty=body.insertRow().insertCell();
      empty.colSpan=3;
      empty.textContent='No events scheduled';
    }
  }
  tab.onclick = ()=>{selectStaffSection(tab);render()};
  for(const court of courtNames){
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type='checkbox';box.name='court';box.value=court;
    label.append(box,court);form.querySelector('fieldset').append(label);
  }
  page.querySelector('header button').onclick = ()=>{
    form.hidden=false;fields.date.value ||= bangkokToday();fields.title.focus();
  };
  fields.cancel.onclick=()=>{form.hidden=true;error.textContent=''};
  fields.repeat.onchange=()=>{
    const repeats=fields.repeat.value==='weekly';
    fields.until.parentElement.hidden=!repeats;
    fields.until.disabled=!repeats;
  };
  form.onsubmit = e=>{
    e.preventDefault();
    const title=fields.title.value.trim(), date=fields.date.value, start=fields.start.value, end=fields.end.value;
    const duration=minutes(end)-minutes(start);
    const courts=Array.from(form.querySelectorAll('[name=court]:checked'),x=>x.value);
    const last=fields.repeat.value==='weekly'?fields.until.value:date;
    if(!title||!courts.length||(last && last<date)||!rows.includes(start)||duration<=0||duration%15||minutes(end)>closingMinute){
      error.textContent='Check the name, courts, dates and opening hours.';return;
    }
    const existing=storedRows('success-padel-bookings'), additions=[];
    const eventId=Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
    for(let occurrence=date;occurrence<=(last||date);occurrence=dateOffset(occurrence,7)){
      for(const court of courts){
        const conflict=existing.find(b=>b.court===court && minutes(b.time)<minutes(end) && minutes(start)<minutes(b.time)+b.duration &&
          (bookingOccursOn(b,occurrence) || (!last && bookingOccursOn({date,weeklyOngoing:true},b.date))));
        if(conflict){
          error.textContent=court+' is already booked on '+longDate(conflict.date>occurrence?conflict.date:occurrence)+'.';return;
        }
        additions.push({eventId,weeklyOngoing:!last,eventRepeat:fields.repeat.value,eventEnd:end,activity:'event',customer:title,court,date:occurrence,time:start,duration,price:0});
      }
      if(!last||occurrence===last)break;
    }
    try{localStorage.setItem('success-padel-bookings',JSON.stringify([...existing,...additions]))}
    catch{error.textContent='Could not save the court bookings.';return}
    form.reset();updateEndTimes();fields.repeat.onchange();error.textContent='';form.hidden=true;
    refreshBookingCalendars();render();
  };
  window.addEventListener('storage',render);
})();
