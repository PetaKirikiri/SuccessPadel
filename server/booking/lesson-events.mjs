import { randomUUID } from 'node:crypto';

const courts = 'success-padel-bookings';
const packages = 'success-booking-packages-v1';
const cutoff = 12 * 60 * 60 * 1000;
const minutes = time => Number(time.slice(0,2))*60 + Number(time.slice(3));
function overlaps(a,b) {
  const sameDay = a.date === b.date || (a.weeklyOngoing && a.date < b.date &&
    (Date.parse(b.date)-Date.parse(a.date)) % 604800000 === 0);
  return sameDay && minutes(a.time)<minutes(b.time)+b.duration && minutes(b.time)<minutes(a.time)+a.duration;
}
export function applyLessonChanges(records,next,now=Date.now()) {
  const prior=records[courts] || [];
  const changes=[];
  const cancellations=[...(records.lessonCancellations || [])];
  const output={...records,[courts]:next,lessonCancellations:cancellations};
  const lessons=rows=>rows.filter(b=>b.activity==='coaching' && b.id);
  const byId=new Map(lessons(prior).map(b=>[b.id,b]));
  const current=new Map(lessons(next).map(b=>[b.id,b]));
  if(current.size!==lessons(next).length)throw Error('Duplicate lesson.');
  const balance=id=>{
    if(!id)return null;
    const pack=(records[packages]||[]).find(p=>p.id===id);
    if(!pack)throw Error('Package unavailable.');
    return pack.count-(pack.previousSessionsUsed||0)-next.filter(b=>b.packageId===id).length
      -(records['success-pilates-bookings']||[]).filter(b=>b.packageId===id).length
      -cancellations.filter(b=>b.packageId===id && b.late).length;
  };
  for(const b of byId.values())if(!current.has(b.id)){
    const late=Date.parse(b.date+'T'+b.time+':00+07:00')-now<cutoff;
    cancellations.push({...b,late,cancelledAt:new Date(now).toISOString()});
    changes.push({kind:'cancelled',booking:b,remaining:balance(b.packageId)});
  }
  for(const b of current.values())if(!byId.has(b.id)){
    if(cancellations.some(c=>c.id===b.id))throw Error('Lesson already cancelled.');
    const start=minutes(b.time);
    const windows=(records['success-coach-availability']||[]).filter(w=>w.date===b.date&&w.coach===b.coach).sort((a,c)=>minutes(a.time)-minutes(c.time));
    let end=start;
    for(const w of windows)if(minutes(w.time)<=end)end=Math.max(end,minutes(w.time)+w.duration);
    if(!['Court 3','Court 4'].includes(b.court)||![60,90].includes(b.duration)||end<start+b.duration||
      next.some(other=>other!==b && (other.court===b.court||other.coach===b.coach)&&overlaps(other,b)))throw Error('Lesson time unavailable.');
    const remaining=balance(b.packageId);
    if(b.packageId){
      const pack=records[packages].find(p=>p.id===b.packageId);
      if(pack.memberId!==b.customerId||!['padel5','padel10'].includes(pack.kind)||b.duration!==60||pack.purchased>b.date||pack.expires<b.date||remaining<0)throw Error('Package unavailable.');
    }
    changes.push({kind:'booked',booking:b,remaining});
  }
  return {output,changes};
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
