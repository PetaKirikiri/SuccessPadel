import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type LineUser = { sub: string; name?: string; picture?: string }

async function fetchLineUser(idToken: string): Promise<LineUser | null> {
  const verify = await fetch('https://api.line.me/oauth2/v2.1/userinfo', {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (verify.ok) {
    const u = (await verify.json()) as { sub?: string; name?: string; picture?: string }
    if (u.sub) return { sub: u.sub, name: u.name, picture: u.picture }
  }

  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!profileRes.ok) return null

  const p = (await profileRes.json()) as {
    userId?: string
    displayName?: string
    pictureUrl?: string
  }
  if (!p.userId) return null
  return { sub: p.userId, name: p.displayName, picture: p.pictureUrl }
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

    const lineUser = await fetchLineUser(id_token)
    if (!lineUser) {
      return new Response(JSON.stringify({ error: 'Invalid LINE token' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const email = `line_${lineUser.sub}@successpadel.local`

    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('line_user_id', lineUser.sub)
      .maybeSingle()

    let userId = existing?.id as string | undefined

    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          display_name: lineUser.name ?? 'Player',
          avatar_url: lineUser.picture,
          line_user_id: lineUser.sub,
        },
      })
      if (error) {
        const { data: list } = await admin.auth.admin.listUsers()
        const found = list.users.find(
          (u) => u.email === email || u.user_metadata?.line_user_id === lineUser.sub,
        )
        userId = found?.id
        if (!userId) throw error
      } else {
        userId = created.user.id
      }
    }

    await admin.from('profiles').upsert({
      id: userId,
      display_name: lineUser.name ?? 'Player',
      avatar_url: lineUser.picture ?? null,
      line_user_id: lineUser.sub,
    })

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
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
