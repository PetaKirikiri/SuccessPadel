import test from 'node:test'
import assert from 'node:assert/strict'
import { processFeedback } from './feedback.mjs'

function fixture({staff=true}={}) {
 const coach=crypto.randomUUID(),player=crypto.randomUUID(),rows=new Map(),calls=[]
 const db={auth:{getUser:async()=>({data:{user:{id:coach}}})},rpc:async()=>({data:staff}),from(table){
   let operation='select',value,filters=[],single=false,head=false
   const query={
     select(_cols,opts){head=!!opts?.head;return query},eq(k,v){filters.push([k,v]);return query},gte(){return query},limit(){return query},
     maybeSingle(){single=true;return query},insert(v){operation='insert';value=v;return query},update(v){operation='update';value=v;return query},
     then(resolve,reject){return Promise.resolve().then(()=>{
       if(table==='padel_players')return{data:{id:player,display_name:'Alex'}}
       if(table==='session_players')return{data:[{id:crypto.randomUUID()}]}
       if(operation==='insert'){
         if(rows.has(value.id))return{error:{code:'23505'}}
         rows.set(value.id,{...value,status:'processing',updated_at:new Date().toISOString(),created_at:new Date().toISOString()});return{data:null}
       }
       const matches=[...rows.values()].filter(row=>filters.every(([k,v])=>row[k]===v))
       if(operation==='update')matches.forEach(row=>Object.assign(row,value))
       return{data:head?null:single?(matches[0]?structuredClone(matches[0]):null):structuredClone(matches),count:matches.length}
     }).then(resolve,reject)},
   };return query
 }}
 const note={observations:[{category:'attack',skill:'Volleys',kind:'strength',observation:'Good volleys.',next_step:'',evidence:'Alex volleys well.'}]}
 const dependencies={createClient:()=>db,fetcher:async(url)=>{
   calls.push(url)
   if(url.endsWith('transcriptions'))return Response.json({text:'Alex volleys well.'})
   return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(note)}}],usage:{total_tokens:5}})
 }}
 const input={id:crypto.randomUUID(),playerId:player,competitionId:null,seconds:12,mime:'audio/webm',audio:Buffer.alloc(200,1).toString('base64')}
 const env={SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'test',OPENAI_API_KEY:'test'}
 return{input,env,dependencies,rows,calls,coach}
}
test('full pipeline persists identity, transcript, structured feedback and usage; retry is idempotent',async()=>{
 const f=fixture();const result=await processFeedback(f.input,'Bearer test',f.env,f.dependencies)
 const row=f.rows.get(result.id)
 assert.equal(row.player_id,f.input.playerId);assert.equal(row.coach_id,f.coach);assert.equal(row.status,'complete')
 assert.equal(row.transcript,'Alex volleys well.');assert.equal(row.model,'gpt-4o-mini');assert.equal(row.usage.total_tokens,5)
 await processFeedback(f.input,'Bearer test',f.env,f.dependencies)
 assert.equal(f.calls.length,2);assert.equal(f.rows.size,1)
 await assert.rejects(processFeedback({...f.input,audio:Buffer.alloc(200,2).toString('base64')},'Bearer test',f.env,f.dependencies),e=>e.status===409)
})
test('nonstaff is rejected before AI or database writes',async()=>{
 const f=fixture({staff:false});await assert.rejects(processFeedback(f.input,'Bearer test',f.env,f.dependencies),e=>e.status===403)
 assert.equal(f.rows.size,0);assert.equal(f.calls.length,0)
})
test('GPT failure preserves transcript, retry skips Whisper',async()=>{
 const f=fixture();const fetcher=f.dependencies.fetcher
 f.dependencies.fetcher=async(url,req)=>url.endsWith('completions')?Response.json({error:{type:'insufficient_quota'}},{status:429}):fetcher(url,req)
 await assert.rejects(processFeedback(f.input,'Bearer test',f.env,f.dependencies),e=>e.status===402)
 assert.equal(f.rows.get(f.input.id).status,'error');assert.equal(f.rows.get(f.input.id).transcript,'Alex volleys well.')
 f.dependencies.fetcher=fetcher
 await processFeedback(f.input,'Bearer test',f.env,f.dependencies)
 assert.equal(f.calls.filter(url=>url.endsWith('transcriptions')).length,1)
 assert.equal(f.rows.get(f.input.id).status,'complete')
})
test('concurrent in-progress submission rejected',async()=>{
 const f=fixture();let release
 const waiting=new Promise(resolve=>{release=resolve})
 const fetcher=f.dependencies.fetcher
 f.dependencies.fetcher=async(url,req)=>{await waiting;return fetcher(url,req)}
 const first=processFeedback(f.input,'Bearer test',f.env,f.dependencies)
 await new Promise(resolve=>setTimeout(resolve,10))
 await assert.rejects(processFeedback(f.input,'Bearer test',f.env,f.dependencies),e=>e.status===409)
 release();await first;assert.equal(f.rows.size,1)
})
