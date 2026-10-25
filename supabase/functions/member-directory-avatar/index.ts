import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-directory-owner, x-member-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers })
const maxBytes = 5 * 1024 * 1024
// The caller is checked by the same database gate as directory edits before any
// bytes enter Storage. No service credential or owner token is returned/logged.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers })
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' })
  try {
    const memberId = req.headers.get('x-member-id') ?? ''
    const ownerToken = req.headers.get('x-directory-owner') || null
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) return reply(400, { error: 'Invalid player' })
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('authorization') ?? '' } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: allowed, error: permissionError } = await caller.rpc('can_edit_member_directory', { p_access_token: ownerToken })
    if (permissionError || allowed !== true) return reply(403, { error: 'Owner access required' })
    const { data: members, error: memberError } = await caller.rpc('list_owner_member_directory', { p_access_token: ownerToken })
    if (memberError) return reply(503, { error: 'Could not check player. Try again.' })
    if (!members?.some((m: { id: string }) => m.id === memberId)) return reply(404, { error: 'Player not found' })
    if (Number(req.headers.get('content-length')) > maxBytes) return reply(413, { error: 'Image must be 5 MB or smaller.' })
    const reader = req.body?.getReader()
    if (!reader) return reply(400, { error: 'Choose a photo' })
    const chunks: Uint8Array[] = []; let length = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > maxBytes) { await reader.cancel(); return reply(413, { error: 'Image must be 5 MB or smaller.' }) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(length); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    const mime = png ? 'image/png' : jpg ? 'image/jpeg' : webp ? 'image/webp' : null
    if (!mime || req.headers.get('content-type')?.split(';')[0] !== mime) return reply(400, { error: 'Choose a JPG, PNG or WebP image.' })
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const path = `${memberId}/directory-${crypto.randomUUID()}.${png ? 'png' : jpg ? 'jpg' : 'webp'}`
    const { error } = await admin.storage.from('avatars').upload(path, bytes, { contentType: mime, upsert: false })
    if (error) return reply(503, { error: 'Photo upload failed. Try again.' })
    const { data } = admin.storage.from('avatars').getPublicUrl(path)
    return reply(200, { url: data.publicUrl })
  } catch {
    return reply(500, { error: 'Could not upload photo. Try again.' })
  }
})
