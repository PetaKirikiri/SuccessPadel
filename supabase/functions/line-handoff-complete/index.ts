import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { handoff_token } = await req.json()
    if (!handoff_token) {
      return new Response(JSON.stringify({ error: 'Missing handoff_token' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: rows, error } = await admin.rpc('consume_player_line_handoff', {
      p_handoff_token: handoff_token,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const row = (rows as {
      competition_id: string | null
      padel_player_id: string
      line_user_id: string
      access_token: string
      refresh_token: string
    }[])?.[0]

    if (!row?.access_token || !row.refresh_token) {
      return new Response(JSON.stringify({ error: 'Invalid handoff token' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        competition_id: row.competition_id,
        padel_player_id: row.padel_player_id,
        line_user_id: row.line_user_id,
        status: 'linked',
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
