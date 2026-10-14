import assert from 'node:assert/strict'
import { englishDestination, englishEntry, englishLoginCallback, englishTicketUrl } from '../src/lib/line/englishEntry'
import { englishHandshake } from '../src/lib/line/englishHandshake'

const entry = { signup:true, attempted:false, mode:'padel' as const }
for (const query of ['?app=englishsuccess&mode=padel&intent=signup','?liff.state=%3Fapp%3Denglishsuccess%26mode%3Dpadel%26intent%3Dsignup']) assert.deepEqual(englishEntry(query),entry)
assert.deepEqual(englishEntry(new URL(englishLoginCallback(true,'padel')).search),{...entry,attempted:true})
assert.equal(englishEntry('?app=englishsuccess&mode=https://evil.example'),null)
assert.equal(englishEntry('?app=englishsuccess&mode=padel&lpl=claim'),null)
assert.equal(englishEntry('?app=englishsuccess&mode=padel&sp_return_to=/friendly'),null)
assert.equal(englishTicketUrl('single-use','padel'),'https://learn-english-coral.vercel.app/padel#ticket=single-use')
const line = { init:async () => {}, isLoggedIn:() => true, getIDToken:() => 'verified-server-side', getAccessToken:() => 'line-access', login:() => {} }
for (const isNew of [false,true]) {
  const replies = isNew ? [{recognised:false},{access_token:'discarded',refresh_token:'discarded'},{recognised:true,ticket:'single-use'}] : [{recognised:true,ticket:'single-use'}]
  const calls:string[]=[]
  const url = await englishHandshake(entry,line,async name => {calls.push(name);return replies.shift()!})
  assert.equal(url,englishTicketUrl('single-use','padel'))
  assert.deepEqual(calls,isNew ? ['line-liff-recognize','line-liff-auth','line-liff-recognize'] : ['line-liff-recognize'])
}
assert.equal(await englishHandshake({...entry,signup:false},line,async()=>({recognised:false})),`${englishDestination('padel')}?line_result=new`)
let approval = ''
assert.equal(await englishHandshake(entry,{...line,isLoggedIn:()=>false,login:({redirectUri}:{redirectUri:string})=>{approval=redirectUri}},async()=>({})),null)
assert.deepEqual(englishEntry(new URL(approval).search),{...entry,attempted:true})
console.log('Padel English: new/existing accounts, approval, fixed return route and claim isolation passed')
