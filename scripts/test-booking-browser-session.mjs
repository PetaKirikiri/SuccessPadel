import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/booking-staff.mjs';
import {beginRemembered, rememberCookie, returningCookie, saveBrowserSession, ownerLifetime, staffLifetime} from '../server/booking/browser-session.mjs';

const now = Math.floor(Date.now()/1000);
const user = {id:'test-user', email:'test@example.invalid', app_metadata:{}};
const subject = 'booking-session-test';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function session(signedIn) {
  const claims = {sub:user.id,session_id:subject,iat:now,exp:now+3600,aal:'aal1',
    amr:[{method:'password',timestamp:signedIn}]};
  return {access_token:[encode({alg:'HS256'}),encode(claims),'c2ln'].join('.'), refresh_token:'test-rotated', token_type:'bearer',expires_in:3600,user};
}
function response() {
  const headers = new Map();
  return {headers,setHeader:(k,v)=>headers.set(k,v), getHeader:k=>headers.get(k),
    status(status){this.statusCode=status; return this;}, json(payload){this.payload=payload;}};
}
function jar(res) {
  return Object.fromEntries(res.getHeader('Set-Cookie').map(c=>c.split(';')[0].split('=')));
}
function cookies(values) { return Object.entries(values).map(([key,value])=>key+'='+value).join('; '); }
async function probe(cookies, action='session') {
  const res=response();
  await handler({method:'POST',headers:{host:'test.example',origin:'https://test.example','content-type':'application/json',cookie:cookies},body:{action}},res);
  return res;
}

test('public and remembered booking entry', async t => {
  process.env.BOOKING_SUPABASE_URL='https://booking-test.invalid';
  process.env.BOOKING_SUPABASE_PUBLISHABLE_KEY='test-key';
  process.env.BOOKING_GOOGLE_SESSION_KEY='booking-test-only';
  const guest = await probe('');
  assert.equal(guest.statusCode,401);
  assert.equal(guest.payload.returning,false);
  for(const [role,hours,active] of [['owner',4,true],['owner',5,false],['front_desk',24,true],['front_desk',720,false]]) {
    await t.test(role+' after '+hours+' hours',async t=>{
      const start=now-hours*3600;
      const provider=session(start);
      const remembered=beginRemembered(provider,role,role==='owner',start);
      assert.equal(remembered.until-start,role==='owner'?ownerLifetime:staffLifetime);
      const initial=response(); saveBrowserSession(initial, provider, remembered, start);
      const saved=jar(initial);
      // The access cookie has expired while the browser was closed.
      const calls=[];
      t.mock.method(globalThis,'fetch',async (input,options={})=>{
        const {pathname,search}=new URL(typeof input==='string'?input:input.url);
        calls.push(pathname+search);
        let body;
        if(pathname==='/auth/v1/token') body=provider;
        else if(pathname==='/auth/v1/user') body=user;
        else if(pathname==='/rest/v1/booking_staff_access') body=[{role}];
        else if(pathname==='/rest/v1/rpc/booking_accept_google_session' || pathname==='/rest/v1/rpc/booking_has_google_session') body=true;
        else throw new Error('Unexpected data request '+pathname);
        return Response.json(body);
      });
      const result=await probe(cookies({[rememberCookie]:saved[rememberCookie],[returningCookie]:'1'}));
      assert.equal(result.statusCode,active?200:401);
      if(active) {
        assert.deepEqual(result.payload,{role});
        assert.ok(calls.includes('/auth/v1/token?grant_type=refresh_token'));
        assert.ok(result.getHeader('Set-Cookie').every(value=>value.includes('Secure; HttpOnly; SameSite=Strict')));
        if(role==='owner') assert.equal(result.getHeader('X-Booking-Reauth-At'),String(start+ownerLifetime));
      } else {
        assert.equal(calls.length,0);
        assert.equal(result.payload.returning,true);
      }
    });
  }
  await t.test('sign-out clears browser recognition',async()=>{
    const result=await probe(cookies({[returningCookie]:'1'}),'logout');
    assert.equal(result.statusCode,200);
    assert.ok(result.getHeader('Set-Cookie').every(cookie=>cookie.includes('Max-Age=0')));
    assert.ok(Object.hasOwn(jar(result),returningCookie));
  });
});
