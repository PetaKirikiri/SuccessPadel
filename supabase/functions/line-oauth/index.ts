import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type LineUser = { sub: string; name?: string; picture?: string }

async function lineUserFromAccessToken(accessToken: string): Promise<LineUser | null> {
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
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

async function sessionForLineUser(admin: ReturnType<typeof createClient>, lineUser: LineUser) {
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

  return {
    access_token: session.session?.access_token,
    refresh_token: session.session?.refresh_token,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { code, redirect_uri } = await req.json()
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing code or redirect_uri' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const channelId = Deno.env.get('LINE_CHANNEL_ID') ?? ''
    const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET') ?? ''
    if (!channelId || !channelSecret) {
      return new Response(JSON.stringify({ error: 'LINE channel not configured on server' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    })

    if (!tokenRes.ok) {
      const detail = await tokenRes.text()
      return new Response(JSON.stringify({ error: `LINE token exchange failed: ${detail}` }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const tokens = (await tokenRes.json()) as { access_token?: string }
    if (!tokens.access_token) {
      return new Response(JSON.stringify({ error: 'No access token from LINE' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const lineUser = await lineUserFromAccessToken(tokens.access_token)
    if (!lineUser) {
      return new Response(JSON.stringify({ error: 'Could not load LINE profile' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const session = await sessionForLineUser(admin, lineUser)

    return new Response(JSON.stringify(session), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
