// Run locally with the club's OAuth client configured. No token is printed.
import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
const env = process.env
for (const key of ['YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET','YOUTUBE_CHANNEL_ID']) if (!env[key]) throw new Error(`Missing ${key}`)
const state = randomBytes(32).toString('base64url')
const verifier = randomBytes(48).toString('base64url')
const redirect = 'http://127.0.0.1:8099/callback'
const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
url.search = new URLSearchParams({client_id:env.YOUTUBE_CLIENT_ID,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/youtube.force-ssl',access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString()
let used = false
const server = createServer(async(req,res) => {
  const callback = new URL(req.url,redirect)
  if (used || callback.pathname !== '/callback' || callback.searchParams.get('state') !== state || !callback.searchParams.get('code')) {res.writeHead(400);res.end('Invalid authorization callback.');return}
  used=true
  try {
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),body:new URLSearchParams({client_id:env.YOUTUBE_CLIENT_ID,client_secret:env.YOUTUBE_CLIENT_SECRET,redirect_uri:redirect,code:callback.searchParams.get('code'),code_verifier:verifier,grant_type:'authorization_code'})})
    const token=await response.json()
    if (!response.ok || !token.refresh_token) throw new Error('No offline authorization returned; repeat club consent.')
    const channel=await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(15000)})
    const result=await channel.json()
    if (!channel.ok || !result.items?.some(c=>c.id===env.YOUTUBE_CHANNEL_ID)) throw new Error('The selected YouTube channel is not the club channel.')
    await writeFile('server/streaming/youtube.env.local',`YOUTUBE_REFRESH_TOKEN=${JSON.stringify(token.refresh_token)}\n`,{mode:0o600,flag:'wx'})
    res.end('Club YouTube connected. You may close this window.');console.log('Saved refresh token to server/streaming/youtube.env.local. Transfer securely into the server environment.')
  } catch(e) {res.writeHead(400);res.end(e.message)}
  finally {server.close()}
})
server.listen(8099,'127.0.0.1',()=>console.log(`Open this URL as the club channel owner:\n${url.href}`))
setTimeout(()=>{server.close();console.log('Authorization window expired.')},10*60000).unref()
