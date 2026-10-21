import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
// Intentionally public registration. The service-only SQL operation restricts
// edits to unstarted competitions and records recoverable snapshots atomically.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers })
  if (req.method !== 'POST') return new Response(null, { status: 405, headers })
  try {
    const raw = await req.text()
    if (raw.length > 32768) throw new Error('Request too large')
    const body = JSON.parse(raw)
    if (!/^[0-9a-f-]{36}$/i.test(body.sessionId ?? '')) throw new Error('Invalid registration')
    const reorder = body.action === 'reorder'
    if (reorder ? !Array.isArray(body.expectedSlots) || !Array.isArray(body.occupantOrder) : !Array.isArray(body.changes)) throw new Error('Invalid registration')
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error } = reorder
      ? await client.rpc('public_competition_signup_reorder', { p_session_id: body.sessionId, p_expected_slots: body.expectedSlots, p_occupant_order: body.occupantOrder })
      : await client.rpc('public_competition_member_signup', { p_session_id: body.sessionId, p_changes: body.changes })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 409, headers })
    return new Response(JSON.stringify({ saved: true }), { headers })
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid registration request' }), { status: 400, headers })
  }
})
