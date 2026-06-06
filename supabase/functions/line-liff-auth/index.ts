import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { id_token } = await req.json()
    if (!id_token) {
      return new Response(JSON.stringify({ error: 'Missing id_token' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const verify = await fetch(
      'https://api.line.me/oauth2/v2.1/userinfo',
      { headers: { Authorization: `Bearer ${id_token}` } },
    )
    if (!verify.ok) {
      const profileRes = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${id_token}` },
      })
      if (!profileRes.ok) {
        return new Response(JSON.stringify({ error: 'Invalid LINE token' }), {
          status: 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
    }

    const lineUser = (await verify.json()) as { sub?: string; name?: string; picture?: string }
    const lineUserId = lineUser.sub
    if (!lineUserId) {
      return new Response(JSON.stringify({ error: 'No LINE user id' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('line_user_id', lineUserId)
      .maybeSingle()

    let userId = existing?.id as string | undefined

    if (!userId) {
      const email = `line_${lineUserId}@successpadel.local`
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          display_name: lineUser.name ?? 'Player',
          avatar_url: lineUser.picture,
          line_user_id: lineUserId,
        },
      })
      if (error) {
        const { data: list } = await admin.auth.admin.listUsers()
        const found = list.users.find((u) => u.user_metadata?.line_user_id === lineUserId)
        userId = found?.id
        if (!userId) throw error
      } else {
        userId = created.user.id
      }
      await admin.from('profiles').upsert({
        id: userId,
        display_name: lineUser.name ?? 'Player',
        avatar_url: lineUser.picture ?? null,
        line_user_id: lineUserId,
      })
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: `line_${lineUserId}@successpadel.local`,
    })
    if (linkErr) throw linkErr

    const tokenHash = link.properties?.hashed_token
    const { data: session, error: sessErr } = await admin.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    })
    if (sessErr) throw sessErr

    return new Response(
      JSON.stringify({
        access_token: session.session?.access_token,
        refresh_token: session.session?.refresh_token,
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
