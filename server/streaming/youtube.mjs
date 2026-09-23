export class YouTube {
  constructor(env, request = fetch) { this.env = env; this.request = request; this.expires = 0 }
  async token() {
    if (Date.now() < this.expires) return this.access
    const response = await this.request('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(15000), body: new URLSearchParams({
        client_id: this.env.YOUTUBE_CLIENT_ID, client_secret: this.env.YOUTUBE_CLIENT_SECRET,
        refresh_token: this.env.YOUTUBE_REFRESH_TOKEN, grant_type: 'refresh_token',
      }),
    })
    const result = await response.json()
    if (!response.ok || !result.access_token) throw new Error('Club YouTube authorization needs attention')
    this.access = result.access_token; this.expires = Date.now() + (result.expires_in - 60) * 1000
    return this.access
  }
  async api(resource, params, body, method = body ? 'POST' : 'GET') {
    const response = await this.request(`https://www.googleapis.com/youtube/v3/${resource}?${new URLSearchParams(params)}`, {
      method, signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const result = response.status === 204 ? {} : await response.json()
    if (!response.ok) throw new Error(`YouTube: ${result.error?.errors?.[0]?.reason ?? response.status}`)
    return result
  }
  async verifyChannel() {
    const channels = await this.api('channels', { part: 'id', mine: 'true' })
    if (!channels.items?.some(c => c.id === this.env.YOUTUBE_CHANNEL_ID)) throw new Error('YouTube account does not match the club channel')
  }
  createBroadcast(match, id, title) {
    return this.api('liveBroadcasts', { part: 'snippet,status,contentDetails' }, {
      snippet: { title, description: `${match.event_name}\n${match.court_name} · Round ${match.round_number}\n${match.teams.a.join(' & ')} vs ${match.teams.b.join(' & ')}\nSuccess Padel recording reference: ${id}`,
        scheduledStartTime: new Date(Math.max(Date.now() + 60000, Date.parse(match.starts_at))).toISOString() },
      status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: this.env.YOUTUBE_MADE_FOR_KIDS === 'true' },
      contentDetails: { enableAutoStart: false, enableAutoStop: false, recordFromStart: true, enableDvr: true, monitorStream: { enableMonitorStream: false } },
    })
  }
  createStream(title) { return this.api('liveStreams', { part: 'snippet,cdn,contentDetails' }, {
    snippet: { title }, cdn: { ingestionType: 'rtmp', resolution: 'variable', frameRate: 'variable' }, contentDetails: { isReusable: false },
  }) }
  bind(id, streamId) { return this.api('liveBroadcasts/bind', { id, streamId, part: 'id' }, {}) }
  transition(id, broadcastStatus) { return this.api('liveBroadcasts/transition', { id, broadcastStatus, part: 'status' }, {}) }
  async stream(id) { return (await this.api('liveStreams', { id, part: 'cdn,status' })).items?.[0] }
  async broadcast(id) { return (await this.api('liveBroadcasts', { id, part: 'status' })).items?.[0] }
}
