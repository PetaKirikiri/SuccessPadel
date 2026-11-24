import test from 'node:test';
import assert from 'node:assert/strict';
import {applyLessonChanges} from '../server/booking/lesson-events.mjs';
const key='success-padel-bookings';
const booking={id:'lesson',activity:'coaching',coach:'Peta',court:'Court 3',customerId:'customer',packageId:'pack',date:'2026-11-24',time:'21:00',duration:60};
const records={'success-coach-availability':[booking],'success-booking-packages-v1':[{id:'pack',memberId:'customer',kind:'padel10',count:10,previousSessionsUsed:8,purchased:'2026-11-24',expires:'2027-02-22'}]};
for(const [hour,late,left] of [['09:00',false,2],['09:01',true,1]]){
  test('Cancellation at '+hour,()=>{
    const created=applyLessonChanges(records,[booking]);
    assert.equal(created.changes[0].remaining,1);
    const cancelled=applyLessonChanges(created.output,[],Date.parse('2026-11-24T'+hour+':00+07:00'));
    assert.equal(cancelled.changes[0].remaining,left);
    assert.equal(cancelled.output.lessonCancellations[0].late,late);
    assert.equal(cancelled.output[key].length,0);
    assert.equal(applyLessonChanges(cancelled.output,[]).changes.length,0);
  });
}
test('Both recipients get the balance on booking and cancellation',async t=>{
  const {sendLessonNotices}=await import('../server/booking/lesson-events.mjs');
  const recipients=['U'+'1'.repeat(32),'U'+'2'.repeat(32)];
  const env={BOOKING_LINE_CHANNEL_ACCESS_TOKEN:'test',BOOKING_LINE_KET_USER_ID:recipients[0],BOOKING_LINE_PETA_USER_ID:recipients[1]};
  const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  Object.assign(process.env,env);
  t.after(()=>{for(const [k,v] of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v});
  const sent=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{sent.push(JSON.parse(options.body));return {ok:true}});
  const b={...booking,customer:'Ket',customerId:'padel-card-012'};
  for(const kind of ['booked','cancelled']){
    assert.equal(await sendLessonNotices([{booking:b,kind,remaining:1}],true),true);
    assert.deepEqual(sent.splice(0).map(m=>[m.to,m.messages[0].text.includes(kind),m.messages[0].text.includes('1 lesson remaining')]),recipients.map(id=>[id,true,true]));
  }
});
