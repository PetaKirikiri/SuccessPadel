import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type DebugEvent = {
  sessionId?: string
  seq?: number
  location?: string
  message?: string
  hypothesisId?: string
  data?: Record<string, unknown>
  timestamp?: number
  pageUrl?: string
  userAgent?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = (await req.json()) as { events?: DebugEvent[] } | DebugEvent
    const events = Array.isArray((body as { events?: DebugEvent[] }).events)
      ? (body as { events: DebugEvent[] }).events
      : [body as DebugEvent]

    if (!events.length) {
      return new Response(JSON.stringify({ error: 'No events' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const url = Deno.env.get('SUPABASE_URL')!
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(url, key)

    const rows = events.slice(0, 20).map((e) => ({
      session_id: String(e.sessionId ?? 'unknown').slice(0, 32),
      seq: Number(e.seq ?? 0),
      location: String(e.location ?? 'unknown').slice(0, 120),
      message: String(e.message ?? '').slice(0, 200),
      hypothesis_id: e.hypothesisId ? String(e.hypothesisId).slice(0, 16) : null,
      data: e.data ?? {},
      page_url: e.pageUrl ? String(e.pageUrl).slice(0, 500) : null,
      user_agent: e.userAgent ? String(e.userAgent).slice(0, 300) : null,
    }))

    const { error } = await db.from('login_debug_events').insert(rows)
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
