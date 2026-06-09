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
  if (profileRes.ok) {
    const p = (await profileRes.json()) as {
      userId?: string
      displayName?: string
      pictureUrl?: string
    }
    if (p.userId) {
      return { sub: p.userId, name: p.displayName, picture: p.pictureUrl }
    }
  }

  const userinfoRes = await fetch('https://api.line.me/oauth2/v2.1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!userinfoRes.ok) return null

  const u = (await userinfoRes.json()) as { sub?: string; name?: string; picture?: string }
  if (!u.sub) return null
  return { sub: u.sub, name: u.name, picture: u.picture }
}

async function magicLinkEmailForUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  fallbackEmail: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) throw error
  return data.user.email ?? fallbackEmail
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | undefined> {
  for (let page = 1; page <= 20; page++) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = list.users.find((u) => u.email === email)
    if (found?.id) return found.id
    if (list.users.length < 200) break
  }
  return undefined
}

async function sessionForLineUser(admin: ReturnType<typeof createClient>, lineUser: LineUser) {
  const email = `line_${lineUser.sub}@successpadel.local`

  const { data: existing } = await admin
    .from('profiles')
    .select('id, display_name, avatar_url')
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
      userId = await findAuthUserIdByEmail(admin, email)
      if (!userId) throw error
    } else {
      userId = created.user.id
    }
  }

  const profilePatch: Record<string, string | null> = {
    id: userId,
    line_user_id: lineUser.sub,
    display_name: lineUser.name ?? existing?.display_name ?? 'Player',
    avatar_url: lineUser.picture ?? existing?.avatar_url ?? null,
  }

  const { error: profileErr } = existing
    ? await admin.from('profiles').update(profilePatch).eq('id', userId)
    : await admin.from('profiles').upsert(profilePatch)
  if (profileErr) throw profileErr

  const linkEmail = await magicLinkEmailForUser(admin, userId, email)
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: linkEmail,
  })
  if (linkErr) throw linkErr

  const tokenHash = link.properties?.hashed_token
  if (!tokenHash) throw new Error('No session token from auth')

  const { data: session, error: sessErr } = await admin.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  })
  if (sessErr) throw sessErr

  return {
    profile_id: userId,
    access_token: session.session?.access_token,
    refresh_token: session.session?.refresh_token,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { code, redirect_uri, link_token } = await req.json()
    if (!code || !redirect_uri || !link_token) {
      return new Response(JSON.stringify({ error: 'Missing code, redirect_uri, or link_token' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const channelId = Deno.env.get('LINE_CHANNEL_ID') ?? ''
    const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET') ?? ''
    if (!channelId || !channelSecret) {
      return new Response(JSON.stringify({ error: 'LINE channel not configured' }), {
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
    if (!session.access_token || !session.refresh_token || !session.profile_id) {
      return new Response(JSON.stringify({ error: 'Could not create session' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: linkRows, error: linkErr } = await admin.rpc('link_padel_player_with_line', {
      p_link_token: link_token,
      p_profile_id: session.profile_id,
      p_line_user_id: lineUser.sub,
      p_line_display_name: lineUser.name ?? null,
      p_line_picture_url: lineUser.picture ?? null,
    })

    if (linkErr) {
      return new Response(JSON.stringify({ error: linkErr.message }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const linkRow = (linkRows as {
      competition_id: string | null
      padel_player_id: string
      handoff_token: string
    }[])?.[0]

    if (!linkRow?.handoff_token) {
      return new Response(JSON.stringify({ error: 'Link failed' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { error: storeErr } = await admin.rpc('store_player_line_handoff', {
      p_handoff_token: linkRow.handoff_token,
      p_competition_id: linkRow.competition_id,
      p_padel_player_id: linkRow.padel_player_id,
      p_line_user_id: lineUser.sub,
      p_access_token: session.access_token,
      p_refresh_token: session.refresh_token,
    })

    if (storeErr) {
      return new Response(JSON.stringify({ error: storeErr.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        handoff_token: linkRow.handoff_token,
        competition_id: linkRow.competition_id,
        padel_player_id: linkRow.padel_player_id,
        line_user_id: lineUser.sub,
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
