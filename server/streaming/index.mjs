import { createServer } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { YouTube } from './youtube.mjs'
import { StreamingService, checked } from './service.mjs'
import { publicStatus, ACTIVE } from './core.mjs'
const env = process.env
for (const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET','YOUTUBE_REFRESH_TOKEN','YOUTUBE_CHANNEL_ID','PUBLISH_SECRET','APP_ORIGIN','WHIP_ORIGIN','TURN_URLS','TURN_SECRET','YOUTUBE_MADE_FOR_KIDS']) {
  if (!env[key]) throw new Error(`Missing server setting: ${key}`)
}
if (env.PUBLISH_SECRET.length < 32) throw new Error('PUBLISH_SECRET must have at least 32 characters')
const db = createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}, global: { fetch: (url,options) => fetch(url,{...options,signal:AbortSignal.timeout(15000)}) }})
const service = new StreamingService(db,new YouTube(env),env)
async function body(req) {
  let text = ''
  for await (const chunk of req) { text += chunk; if (text.length > 16384) throw new Error('Request too large') }
  return text ? JSON.parse(text) : {}
}
function uuid(value) { if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid match reference'); return value }
const server = createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store')
  res.setHeader('Content-Type','application/json')
  const reply = (status,data) => { res.writeHead(status); res.end(JSON.stringify(data)) }
  try {
    const url = new URL(req.url,'http://localhost')
    if (url.pathname === '/internal/media-auth' && req.method === 'POST') {
      return reply(await service.mediaAuth(await body(req)) ? 200 : 403,{})
    }
    if (req.headers.origin !== env.APP_ORIGIN) return reply(403,{error:'Origin not allowed'})
    res.setHeader('Access-Control-Allow-Origin',env.APP_ORIGIN)
    res.setHeader('Vary','Origin')
    res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type')
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') return reply(204,{})
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
    if (!token) return reply(401,{error:'Sign in to Success Padel first'})
    const user = await service.user(token)
    if (req.method === 'GET' && url.pathname === '/matches') {
      const session = url.searchParams.get('session')
      return reply(200,{matches:await service.matches(user,session ? uuid(session) : undefined),isAdmin:user.is_admin})
    }
    if (req.method === 'GET' && url.pathname === '/active') {
      let query = db.from('match_streams').select('*').in('state',ACTIVE)
      if (!user.is_admin) query = query.eq('owner_id',user.id)
      return reply(200,{streams:(await checked(query)).map(publicStatus)})
    }
    if (req.method === 'GET' && url.pathname === '/operators' && user.is_admin) {
      const search = (url.searchParams.get('q') ?? '').replace(/[%_(),.]/g,'').slice(0,60)
      if (search.length < 2) return reply(200,{operators:[]})
      return reply(200,{operators:await checked(db.from('profiles').select('id,display_name').ilike('display_name',`%${search}%`).limit(20))})
    }
    if (req.method === 'POST' && url.pathname === '/assign' && user.is_admin) {
      const input = await body(req)
      const session_id = uuid(input.session_id), court_id = uuid(input.court_id), profile_id = uuid(input.profile_id)
      const match = (await service.matches(user,session_id)).find(m => m.court_id === court_id)
      if (!match) throw new Error('Court is not assigned to this event')
      await checked(db.from('match_stream_assignments').upsert({session_id,court_id,profile_id,expires_at:new Date(Date.now()+12*3600000).toISOString()}))
      return reply(200,{ok:true})
    }
    if (req.method === 'POST' && url.pathname === '/streams') {
      const input = await body(req)
      for (const k of ['session_id','round_id','court_id']) uuid(input[k])
      return reply(200,await service.exclusive(() => service.create(user,input)))
    }
    const match = url.pathname.match(/^\/streams\/([^/]+)(?:\/(publisher|heartbeat|stop))?$/)
    if (match) {
      const id = uuid(match[1]), action = match[2]
      if (!action && req.method === 'GET') return reply(200,publicStatus(await service.own(user,id)))
      if (req.method === 'POST' && action) return reply(200,await service.exclusive(() => service[action](user,id)))
    }
    reply(404,{error:'Not found'})
  } catch(error) { reply(400,{error:error.message}) }
})
server.requestTimeout = 30000
server.listen(Number(env.PORT ?? 8090),'127.0.0.1',() => console.log('Streaming controller listening on loopback'))
let ticking = false
const timer = setInterval(() => {
  if (ticking) return
  ticking = true
  service.exclusive(() => service.tick()).catch(() => console.error('Streaming reconciliation failed; retrying')).finally(() => {ticking=false})
},15000)
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,() => {
  clearInterval(timer); server.close()
  for (const job of service.jobs.values()) job.kill('SIGTERM')
  setTimeout(() => process.exit(0),3000).unref()
})
