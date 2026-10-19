import assert from 'node:assert/strict'
import { englishEntry, englishDestination, englishLoginCallback, englishTicketUrl } from '../src/lib/line/englishEntry'
import { englishHandshake } from '../src/lib/line/englishHandshake'

const entry = { signup: true, attempted: false, mode: 'english' as const }
const query = '?app=englishsuccess&mode=english&intent=signup'
assert.deepEqual(englishEntry(query), entry)
assert.deepEqual(englishEntry('?liff.state='+encodeURIComponent(query)),entry)
assert.deepEqual(englishEntry(new URL(englishLoginCallback(true,'english')).search),{...entry,attempted:true})
assert.equal(englishDestination('english'),'https://learn-english-coral.vercel.app/english')
assert.equal(englishTicketUrl('single-use','english'),'https://learn-english-coral.vercel.app/english#ticket=single-use')
assert.equal(englishEntry(query+'&lpl=claim'),null)
const line={init:async()=>{},isLoggedIn:()=>true,getIDToken:()=>'server-verifies',getAccessToken:()=>'line-access',login:()=>{}}
for(const isNew of [false,true]) {
  const replies=isNew?[{recognised:false},{access_token:'discarded',refresh_token:'discarded'},{recognised:true,ticket:'single-use'}]:[{recognised:true,ticket:'single-use'}]
  const calls:string[]=[]
  const destination=await englishHandshake(entry,line,async name=>{calls.push(name);return replies.shift()!})
  assert.equal(destination,englishTicketUrl('single-use','english'))
  assert.deepEqual(calls,isNew?['line-liff-recognize','line-liff-auth','line-liff-recognize']:['line-liff-recognize'])
}
assert.equal(await englishHandshake({...entry,signup:false},line,async()=>({recognised:false})),englishDestination('english')+'?line_result=new')
assert.equal(englishDestination('hotel'),'https://learn-english-coral.vercel.app/hotel')
assert.equal(englishDestination('padel'),'https://learn-english-coral.vercel.app/padel')
console.log('General English: same accounts, signup/signin, fixed course destination and existing routes passed')
