// The court and room timetables use the club clock, including for visitors abroad.
{
  const clubClock=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  });
  for(const [grid,date] of [[courtCalendar,day],[pGrid,pDay]]){
    const viewport=grid.closest('.calendar-scroll');
    let positionedDate=null;
    let frame=0;
    function update(){
      frame=0;
      if(!viewport.clientHeight || grid.classList.contains('select-lesson-slot'))return;
      const calendarRows=Array.from(grid.querySelectorAll('.calendar-row'));
      if(calendarRows.length!==rows.length)return;
      const today=bangkokToday();
      const now=minutes(clubClock.format(new Date()));
      const isToday=date.value===today;
      for(const [index,row] of calendarRows.entries()){
        const end=minutes(rows[index])+15;
        row.classList.toggle('calendar-elapsed',date.value<today || (isToday && end<=now));
        const quarters=grid===courtCalendar?4:2;
        const start=minutes(rows[index-index%quarters]);
        if(bookingGuest && (date.value<today || (isToday && start<now))){
          for(const cell of row.querySelectorAll('.calendar-cell:enabled')){
            cell.disabled=true;
            cell.tabIndex=-1;
            cell.onclick=null;
            cell.classList.remove('calendar-hour-hover','calendar-hour-hover-start','calendar-hour-hover-end');
            delete cell.dataset.slotTime;
            cell.setAttribute('aria-label',cell.getAttribute('aria-label')+' unavailable');
          }
        }
      }
      const hour=Math.min(rows.length-4,Math.max(0,(Math.floor(now/60)*60-minutes(rows[0]))/15));
      const target=calendarRows[isToday?hour:0];
      const header=grid.querySelector('.calendar-head');
      const top=target.getBoundingClientRect().top-calendarRows[0].getBoundingClientRect().top;
      const contentEnd=calendarRows.at(-1).getBoundingClientRect().bottom;
      const tail=isToday?Math.max(0,viewport.clientHeight-header.offsetHeight-(contentEnd-target.getBoundingClientRect().top)):0;
      viewport.style.setProperty('--calendar-scroll-tail',Math.ceil(tail)+'px');
      if(positionedDate!==date.value){
        viewport.scrollTop=top;
        positionedDate=date.value;
      }
    }
    function schedule(){
      if(!frame)frame=requestAnimationFrame(update);
    }
    new MutationObserver(schedule).observe(grid,{childList:true});
    new ResizeObserver(schedule).observe(viewport);
    new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-booking-locked']});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
    setInterval(()=>{if(!document.hidden)schedule();},60000);
    schedule();
  }
}
