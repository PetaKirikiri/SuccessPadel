import { randomUUID, createHmac } from 'node:crypto'
import { spawn } from 'node:child_process'
import { ACTIVE, titleFor, signPublish, verifyPublish, ffmpegArgs, publicStatus } from './core.mjs'
export async function checked(query) {
  const { data, error } = await query
  if (error) throw new Error(`Database operation failed (${error.code ?? 'unknown'})`)
  return data
}
const until = () => new Date(Date.now() + 90000).toISOString()
export class StreamingService {
  constructor(db, youtube, env) { this.db = db; this.youtube = youtube; this.env = env; this.jobs = new Map(); this.tail = Promise.resolve(); this.archiveAt = 0 }
  // One controller instance per installation; serialize mutations and reconciliation.
  exclusive(work) { const next = this.tail.then(work); this.tail = next.catch(() => {}); return next }
  async user(token) {
    const { data, error } = await this.db.auth.getUser(token)
    if (error || !data.user || data.user.is_anonymous) throw new Error('Sign in to Success Padel first')
    const p = await checked(this.db.from('profiles').select('id,is_admin').eq('id', data.user.id).single())
    return p
  }
  async allowed(user, session, court) {
    if (user.is_admin) return true
    const rows = await checked(this.db.from('match_stream_assignments').select('profile_id').eq('profile_id', user.id)
      .eq('session_id', session).eq('court_id', court).gt('expires_at', new Date().toISOString()))
    return rows.length > 0
  }
  async matches(user, sessionId) {
    let query = this.db.from('competition_rounds').select('id,session_id,round_number,starts_at,ends_at,status,game_sessions(title),competition_round_players(court_id,team,session_players(guest_name,profiles(display_name),padel_players(display_name,profiles(display_name))),courts(name))')
    if (sessionId) query = query.eq('session_id', sessionId)
    else query = query.gte('ends_at', new Date(Date.now() - 3600000).toISOString()).lte('starts_at', new Date(Date.now() + 86400000).toISOString())
    const rounds = await checked(query.order('starts_at').limit(200))
    const assignments = user.is_admin ? [] : await checked(this.db.from('match_stream_assignments').select('session_id,court_id').eq('profile_id',user.id).gt('expires_at',new Date().toISOString()))
    const result = []
    for (const r of rounds) {
      const courts = [...new Set(r.competition_round_players.map(p => p.court_id))]
      for (const court of courts) {
        if (!user.is_admin && !assignments.some(a => a.session_id === r.session_id && a.court_id === court)) continue
        const players = r.competition_round_players.filter(p => p.court_id === court)
        const name = p => p.session_players?.profiles?.display_name?.trim() || p.session_players?.padel_players?.profiles?.display_name?.trim() || p.session_players?.padel_players?.display_name?.trim() || p.session_players?.guest_name?.trim() || 'Player'
        result.push({ round_id: r.id, session_id: r.session_id, court_id: court, court_name: players[0].courts?.name ?? 'Court',
          event_name: r.game_sessions.title, round_number: r.round_number, starts_at: r.starts_at, ends_at: r.ends_at, status: r.status,
          teams: { a: players.filter(p => p.team === 'a').map(name), b: players.filter(p => p.team === 'b').map(name) } })
      }
    }
    return result
  }
  async row(id) { return checked(this.db.from('match_streams').select('*').eq('id', id).single()) }
  async update(id, patch) { return checked(this.db.from('match_streams').update(patch).eq('id', id).select().single()) }
  async own(user, id) {
    const row = await this.row(id)
    if (!user.is_admin && (row.owner_id !== user.id || !await this.allowed(user, row.session_id, row.court_id))) throw new Error('This camera belongs to another operator or the assignment expired')
    return row
  }
  async create(user, input) {
    const match = (await this.matches(user, input.session_id)).find(m => m.round_id === input.round_id && m.court_id === input.court_id)
    if (!match || match.status === 'complete' || Date.parse(match.ends_at) <= Date.now()) throw new Error('This match is not available to stream')
    if (Date.parse(match.starts_at) - Date.now() > 30 * 60000) throw new Error('Streaming opens 30 minutes before the match')
    if (match.teams.a.length !== 2 || match.teams.b.length !== 2) throw new Error('Both teams must be assigned before streaming')
    const active = await checked(this.db.from('match_streams').select('*').in('state', ACTIVE))
    const existing = active.find(r => r.court_id === match.court_id)
    if (existing) throw new Error('This court already has a camera. Stop the existing stream before starting another.')
    const slot = [1,2,3,4].find(n => !active.some(r => r.slot === n))
    if (!slot) throw new Error('All four streaming slots are occupied')
    const id = randomUUID(), title = titleFor(match)
    await checked(this.db.from('match_streams').insert({ id, slot, title, state: 'preparing', owner_id: user.id,
      session_id: match.session_id, round_id: match.round_id, court_id: match.court_id, lease_until: until() }))
    try {
      await this.youtube.verifyChannel()
      const broadcast = await this.youtube.createBroadcast(match, id, title)
      await this.update(id, { broadcast_id: broadcast.id })
      await checked(this.db.from('match_recordings').insert({ id, session_id: match.session_id, round_id: match.round_id,
        court_id: match.court_id, youtube_video_id: broadcast.id, state: 'processing' }))
      const stream = await this.youtube.createStream(title)
      await this.update(id, { youtube_stream_id: stream.id })
      await this.youtube.bind(broadcast.id, stream.id)
      return publicStatus(await this.update(id, { state: 'connecting', lease_until: until() }))
    } catch (error) {
      // Never blindly retry a non-idempotent YouTube insert after an uncertain response.
      await this.update(id, { state: 'stopping', error: `${error.message}. Staff should check YouTube for an unfinished broadcast.` })
      throw new Error('Could not prepare YouTube. Staff should check the streaming dashboard.')
    }
  }
  async publisher(user, id) {
    const row = await this.own(user, id)
    if (!['connecting','live'].includes(row.state)) throw new Error('This stream is not ready for a camera')
    await this.update(id, { lease_until: until() })
    const expires = Date.now() + 120000
    const username = `${Math.floor(Date.now()/1000) + 600}:${id}`
    const credential = createHmac('sha1', this.env.TURN_SECRET).update(username).digest('base64')
    return { url: `${this.env.WHIP_ORIGIN}/court/${id}/whip`, token: signPublish(this.env.PUBLISH_SECRET, id, expires),
      iceServers: [{ urls: this.env.TURN_URLS.split(','), username, credential }] }
  }
  async mediaAuth(body) {
    if (body.action === 'api' && ['127.0.0.1','::1'].includes(body.ip)) return true
    if (body.action === 'read' && body.protocol === 'rtsp' && ['127.0.0.1','::1'].includes(body.ip)) return true
    if (body.action !== 'publish' || body.protocol !== 'webrtc' || !verifyPublish(this.env.PUBLISH_SECRET, body.token || body.password, body.path)) return false
    const row = await this.row(body.path.slice('court/'.length))
    return ['connecting','live'].includes(row.state) && Date.parse(row.lease_until) > Date.now()
  }
  async stop(user, id) { await this.own(user,id); const row = await this.row(id); return publicStatus(ACTIVE.includes(row.state) ? await this.update(id, { state: 'stopping' }) : row) }
  async heartbeat(user, id) {
    const row = await this.own(user,id)
    return publicStatus(['connecting','live'].includes(row.state) ? await this.update(id,{ lease_until: until() }) : row)
  }
  async mtx(path, method = 'GET') {
    const response = await fetch(`http://127.0.0.1:9997/v3/${path}`, { method, signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('Media server unavailable')
    return response.status === 200 && method === 'GET' ? response.json() : null
  }
  async kill(id) {
    const job = this.jobs.get(id)
    if (job) { job.kill('SIGTERM'); setTimeout(() => { if (job.exitCode === null) job.kill('SIGKILL') }, 3000).unref(); this.jobs.delete(id) }
    const sessions = await this.mtx('webrtc/sessions/list')
    for (const s of sessions.items ?? []) if (s.path === `court/${id}`) await this.mtx(`webrtc/sessions/kick/${s.id}`, 'POST')
  }
  async reconcileRow(row) {
    if ((Date.parse(row.lease_until) < Date.now() || Date.now() - Date.parse(row.created_at) > 3 * 3600000) && row.state !== 'stopping') row = await this.update(row.id, { state: 'stopping', error: 'Camera disconnected. Recording is being finalized.' })
    if (row.state === 'connecting' && !row.live_at && Date.now() - Date.parse(row.created_at) > 180000) row = await this.update(row.id, { state: 'stopping', error: 'YouTube did not receive a usable camera feed within three minutes.' })
    if (row.state === 'preparing') return // interrupted preparation expires, then is cleaned up
    if (row.state === 'stopping') {
      await this.kill(row.id)
      if (row.broadcast_id) {
        const b = await this.youtube.broadcast(row.broadcast_id)
        const state = b?.status?.lifeCycleStatus
        if (['live','testing'].includes(state)) { await this.youtube.transition(row.broadcast_id, 'complete'); return }
        if (['liveStarting','testStarting'].includes(state)) return
        if (state && state !== 'complete' && state !== 'revoked') {
          // A broadcast never made live cannot transition to complete.
          await this.youtube.api('liveBroadcasts', { id: row.broadcast_id }, null, 'DELETE').catch(e => { throw e })
        }
        await checked(this.db.from('match_recordings').update({ state: state === 'complete' ? 'processing' : 'unavailable' }).eq('id', row.id))
      }
      await this.update(row.id, { state: row.live_at ? 'complete' : 'failed', ended_at: new Date().toISOString() })
      return
    }
    const stream = await this.youtube.stream(row.youtube_stream_id)
    if (!stream) throw new Error('YouTube stream is missing')
    if (!this.jobs.has(row.id)) {
      const paths = await this.mtx('paths/list')
      if (!paths.items?.some(p => p.name === `court/${row.id}` && p.available)) {
        if (row.state === 'live') await this.update(row.id, { state: 'connecting' })
        return
      }
      const path = paths.items.find(p => p.name === `court/${row.id}`)
      const codecs = path?.tracks2?.map(t => t.codec) ?? []
      if (!codecs.some(c => ['H264','H265','VP8','VP9','AV1'].includes(c)) || !codecs.some(c => ['Opus','MPEG-4 Audio'].includes(c))) {
        await this.update(row.id, { error: 'Waiting for both camera video and microphone audio.' })
        return
      }
      const ingest = stream.cdn?.ingestionInfo
      if (!ingest?.rtmpsIngestionAddress || !ingest.streamName) throw new Error('YouTube did not return secure ingest details')
      const job = spawn('ffmpeg', ffmpegArgs(`rtsp://127.0.0.1:8554/court/${row.id}`, `${ingest.rtmpsIngestionAddress}/${ingest.streamName}`), { stdio: 'ignore' })
      this.jobs.set(row.id, job)
      const clear = () => { if (this.jobs.get(row.id) === job) this.jobs.delete(row.id) }
      job.once('error', clear); job.once('exit', clear)
    }
    const broadcast = await this.youtube.broadcast(row.broadcast_id)
    const state = broadcast?.status?.lifeCycleStatus
    if (['complete','revoked'].includes(state)) { await this.update(row.id, { state: 'stopping' }); return }
    if (state === 'live' && stream.status?.streamStatus === 'active') {
      await this.update(row.id, { state: 'live', live_at: row.live_at ?? new Date().toISOString(), error: null })
      await checked(this.db.from('match_recordings').update({ state: 'live' }).eq('id',row.id))
    } else if (state === 'live' && row.state === 'live') await this.update(row.id, { state: 'connecting' })
    else if (stream.status?.streamStatus === 'active' && ['ready','testing'].includes(state)) await this.youtube.transition(row.broadcast_id,'live')
  }
  async tick() {
    const active = await checked(this.db.from('match_streams').select('*').in('state',ACTIVE))
    for (const row of active) {
      try { await this.reconcileRow(row) }
      catch { console.error(`Streaming reconciliation needs retry: ${row.id}`) }
    }
    if (Date.now() < this.archiveAt) return
    this.archiveAt = Date.now() + 300000
    // Also runs after scoring finishes, so late score records get their video association.
    await checked(this.db.rpc('reconcile_match_recording_links'))
    const recordings = await checked(this.db.from('match_recordings').select('*').eq('state','processing').order('created_at').limit(200))
    for (const r of recordings) {
      if (r.state !== 'processing' || active.some(s => s.id === r.id)) continue
      try {
        const video = (await this.youtube.api('videos', { id: r.youtube_video_id, part: 'status,processingDetails' })).items?.[0]
        const status = video?.processingDetails?.processingStatus
        if (status === 'succeeded') await checked(this.db.from('match_recordings').update({state:'ready'}).eq('id',r.id))
        else if (!video || ['failed','terminated'].includes(status)) await checked(this.db.from('match_recordings').update({state:'unavailable'}).eq('id',r.id))
      } catch { /* retry on the next archive pass */ }
    }
  }
}
