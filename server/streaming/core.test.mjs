import test from 'node:test'
import assert from 'node:assert/strict'
import { titleFor, signPublish, verifyPublish, ffmpegArgs, publicStatus } from './core.mjs'
import { YouTube } from './youtube.mjs'
import { StreamingService } from './service.mjs'
const match = {event_name:'Club',round_number:3,court_name:'Court 2',teams:{a:['Peta','Golf'],b:['Bia','Hunter']},starts_at:new Date().toISOString()}
test('server generates match title, strips forbidden characters, preserves Unicode',()=>{
  assert.equal(titleFor(match),'Success Padel – Round 3 – Court 2 – Peta & Golf vs Bia & Hunter')
  const title=titleFor({...match,teams:{a:['<\n'+'ก'.repeat(200)],b:['B']}})
  assert.equal(Array.from(title).length,100); assert.doesNotMatch(title,/[<>\n]/)
})
test('publisher tokens reject expired, modified, wrong-court and appended tokens',()=>{
  const token=signPublish('secret','camera',2000)
  assert.ok(verifyPublish('secret',token,'court/camera',1000))
  assert.ok(!verifyPublish('secret',token,'court/other',1000))
  assert.ok(!verifyPublish('secret',token,'court/camera',2000))
  assert.ok(!verifyPublish('wrong',token,'court/camera',1000))
  assert.ok(!verifyPublish('secret',token+'.extra','court/camera',1000))
})
test('FFmpeg always converts audio and video; only encrypted YouTube outputs accepted',()=>{
  const args=ffmpegArgs('rtsp://localhost/court/test','rtmps://a.rtmp.youtube.com/live2/key')
  assert.ok(args.includes('aac'));assert.ok(args.includes('libx264'));assert.ok(args.includes('0:a:0'))
  for(const bad of ['rtmp://a.rtmp.youtube.com/live2/key','rtmps://youtube.com.attacker.test/key','file:///tmp/out']) assert.throws(()=>ffmpegArgs('input',bad))
})
test('browser status cannot leak ingest credentials',()=>{
  const result=publicStatus({id:'id',state:'connecting',title:'title',youtube_stream_id:'private',stream_key:'secret',broadcast_id:'abc'})
  assert.equal(result.youtube_stream_id,undefined);assert.equal(result.stream_key,undefined)
  assert.equal(result.videoUrl,'https://www.youtube.com/watch?v=abc')
})
test('YouTube uses offline token, correct broadcast fields and no auto-stop',async()=>{
  const calls=[]
  const yt=new YouTube({YOUTUBE_CLIENT_ID:'client',YOUTUBE_CLIENT_SECRET:'secret',YOUTUBE_REFRESH_TOKEN:'refresh'},async(url,options)=>{
    calls.push({url,options});return new Response(JSON.stringify(url.includes('oauth2')?{access_token:'access',expires_in:3600}:{id:'broadcast'}))
  })
  await yt.createBroadcast(match,'reference',titleFor(match)); await yt.createStream('Court')
  assert.equal(calls.length,3)
  const broadcast=JSON.parse(calls[1].options.body)
  assert.equal(broadcast.status.privacyStatus,'unlisted');assert.equal(broadcast.contentDetails.enableAutoStop,false)
  assert.ok(broadcast.snippet.description.includes('reference'))
  assert.equal(calls[1].options.headers.Authorization,'Bearer access')
})
test('YouTube DELETE accepts an empty 204 response',async()=>{
  const yt=new YouTube({},async()=>new Response(null,{status:204}));yt.expires=Infinity;yt.access='token'
  assert.deepEqual(await yt.api('liveBroadcasts',{id:'b'},null,'DELETE'),{})
})
test('club OAuth rejects a different channel',async()=>{
  const yt=new YouTube({YOUTUBE_CHANNEL_ID:'club'},async()=>new Response(JSON.stringify({items:[{id:'other'}]})));yt.expires=Infinity;yt.access='token'
  await assert.rejects(()=>yt.verifyChannel(),/does not match/)
})
test('stop worker retries complete transition until YouTube actually confirms',async()=>{
  const updates=[], transitions=[]
  const service=new StreamingService({}, {broadcast:async()=>({status:{lifeCycleStatus:'live'}}),transition:async(...args)=>transitions.push(args)}, {})
  service.kill=async()=>{};service.update=async(...args)=>updates.push(args)
  await service.reconcileRow({id:'id',state:'stopping',broadcast_id:'b',lease_until:new Date(Date.now()+60000).toISOString()})
  assert.deepEqual(transitions,[['b','complete']]);assert.equal(updates.length,0)
})
test('controller serializes simultaneous mutations and recovers after one fails',async()=>{
  const service=new StreamingService({}, {}, {}), order=[]
  const a=service.exclusive(async()=>{order.push(1);await Promise.resolve();throw Error('failed')})
  const b=service.exclusive(async()=>order.push(2))
  await assert.rejects(a);await b;assert.deepEqual(order,[1,2])
})
test('a logged-in operator cannot stop another operator camera',async()=>{
  const service=new StreamingService({}, {}, {})
  service.row=async()=>({owner_id:'other'})
  await assert.rejects(()=>service.own({id:'user',is_admin:false},'stream'),/another operator/)
})
