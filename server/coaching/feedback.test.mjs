import test from 'node:test'
import assert from 'node:assert/strict'
import { inputSchema, validateFeedback, transcribeAudio, organiseTranscript, processFeedback, handleFeedback } from './feedback.mjs'

const transcript='Alex recovers well but should take smaller steps.'
const feedback={observations:[{category:'movement',skill:'Footwork & balance',kind:'improvement',observation:'Use smaller adjustment steps.',next_step:'Practise short steps before contact.',evidence:'should take smaller steps',rating:null,rating_source:null}]}
test('valid evidence and exact subskill accepted',()=>assert.equal(validateFeedback(feedback,transcript).observations.length,1))
test('invented evidence rejected',()=>assert.throws(()=>validateFeedback(feedback,'Something else')))
test('wrong category/subskill rejected',()=>assert.throws(()=>validateFeedback({observations:[{...feedback.observations[0],category:'attack'}]},transcript)))
test('unsupported top-level ratings and fields rejected',()=>assert.throws(()=>validateFeedback({...feedback,rating:9},transcript)))
test('bounded skill ratings retain their source; invalid and unlabelled scores rejected',()=>{
 for(const source of ['coach','estimated']) {
  const rated={observations:[{...feedback.observations[0],rating:6,rating_source:source}]}
  assert.equal(validateFeedback(rated,transcript).observations[0].rating,6)
 }
 for(const change of [{rating:0,rating_source:'estimated'},{rating:11,rating_source:'coach'},
  {rating:6.5,rating_source:'coach'},{rating:6,rating_source:null},{rating:null,rating_source:'estimated'}])
  assert.throws(()=>validateFeedback({observations:[{...feedback.observations[0],...change}]},transcript))
})
test('empty observations are valid, not fabricated',()=>assert.deepEqual(validateFeedback({observations:[]},'Hello'),{observations:[]}))
test('upload validates ids, duration, format and size',()=>{
 const input={id:crypto.randomUUID(),playerId:crypto.randomUUID(),competitionId:null,seconds:20,mime:'audio/mp4',audio:'YQ=='}
 assert.equal(inputSchema.safeParse(input).success,true)
 for(const change of [{playerId:'dave'},{seconds:121},{mime:'text/html'},{audio:'***'},{audio:'a'.repeat(3000000)}]) assert.equal(inputSchema.safeParse({...input,...change}).success,false)
})
test('Whisper upload uses requested model and original audio',async()=>{
 const result=await transcribeAudio(Buffer.from('test'),'audio/mp4',{OPENAI_API_KEY:'test-only'},async(url,req)=>{
   assert.equal(url,'https://api.openai.com/v1/audio/transcriptions')
   assert.equal(req.body.get('model'),'whisper-1')
   assert.equal(req.body.has('language'),false, 'Whisper must auto-detect French and other spoken languages')
   assert.equal(req.body.get('file').name,'observation.m4a')
   return Response.json({text:transcript})
 }); assert.equal(result,transcript)
})
test('empty transcription is rejected before GPT',async()=>{
 await assert.rejects(transcribeAudio(Buffer.from('test'),'audio/webm',{OPENAI_API_KEY:'test-only'},async()=>Response.json({text:''})),/No clear speech/)
})
test('GPT enforces structured response, no storage, server-selected player',async()=>{
 const result=await organiseTranscript(transcript,'Alex',{OPENAI_API_KEY:'test-only'},async(url,req)=>{
  const body=JSON.parse(req.body); assert.equal(body.store,false);assert.equal(body.response_format.json_schema.strict,true)
  assert.equal(JSON.parse(body.messages[1].content).selected_player,'Alex')
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(feedback)}}],usage:{total_tokens:20}})
 });assert.deepEqual(result.feedback,feedback)
})
test('French feedback uses English instructions while retaining verbatim French evidence and coach score',async()=>{
 const french='Alex réussit régulièrement ses volées. Je lui donne sept sur dix pour les volées.'
 const translated={observations:[{category:'attack',skill:'Volleys',kind:'strength',observation:'Alex consistently executes his volleys well.',next_step:'',evidence:'Alex réussit régulièrement ses volées.',rating:7,rating_source:'coach'}]}
 const result=await organiseTranscript(french,'Alex',{OPENAI_API_KEY:'test-only'},async(_url,req)=>{
  const body=JSON.parse(req.body)
  assert.match(body.messages[0].content,/every observation and next_step in clear, concise English/)
  assert.match(body.messages[0].content,/Keep evidence in its original language/)
  assert.doesNotMatch(body.messages[0].content,/feedback in the transcript's language/)
  assert.equal(JSON.parse(body.messages[1].content).transcript,french)
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(translated)}}]})
 })
 assert.deepEqual(result.feedback,translated)
 assert.throws(()=>validateFeedback({observations:[{...translated.observations[0],evidence:'Alex consistently executes his volleys well.'}]},french),/Evidence not in transcript/)
})
test('refusal and truncated results are not saved as observations',async()=>{
 for(const choice of [{finish_reason:'length',message:{}},{finish_reason:'stop',message:{refusal:'no'}}])
  await assert.rejects(organiseTranscript(transcript,'Alex',{OPENAI_API_KEY:'test-only'},async()=>Response.json({choices:[choice]})),/could not be organised/)
})
test('provider errors never expose body/key',async()=>{
 await assert.rejects(transcribeAudio(Buffer.from('test'),'audio/mp4',{OPENAI_API_KEY:'secret'},async()=>Response.json({secret:'secret'},{status:401})),e=>!e.message.includes('secret'))
})
test('unsigned request rejected before parsing or AI calls',async()=>{
  await assert.rejects(processFeedback({},null,{}),e=>e.status===401)
})
test('exhausted credits explains billing and preserves retry',async()=>{
 await assert.rejects(transcribeAudio(Buffer.from('test'),'audio/mp4',{OPENAI_API_KEY:'secret'},async()=>Response.json({error:{type:'insufficient_quota',code:'credit_balance_exhausted'}},{status:429})),e=>e.status===402&&e.message.includes('API credits'))
})
test('HTTP adapter refuses unsigned clients and disallows caching',async()=>{
 const headers={};let result='';const res={setHeader(k,v){headers[k]=v},end(v){result=v}}
 await handleFeedback({method:'POST',headers:{},body:{}},res,{})
 assert.equal(res.statusCode,401);assert.equal(headers['Cache-Control'],'no-store');assert.match(result,/Staff sign-in/)
})
