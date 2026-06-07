import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type LineProfileInput = {
  user_id?: string
  display_name?: string
  picture_url?: string
}

type LineUser = { sub: string; name?: string; picture?: string }

async function lineProfileFromAccessToken(accessToken: string): Promise<LineProfileInput | null> {
  const res = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    userId?: string
    displayName?: string
    pictureUrl?: string
  }
  if (!data.userId || !data.displayName?.trim()) return null
  return {
    user_id: data.userId,
    display_name: data.displayName.trim(),
    picture_url: data.pictureUrl,
  }
}

async function lineUserFromIdToken(idToken: string, channelId: string): Promise<LineUser | null> {
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  })
  if (!verifyRes.ok) return null
  const claims = (await verifyRes.json()) as { sub?: string; name?: string; picture?: string }
  if (!claims.sub) return null
  return { sub: claims.sub, name: claims.name, picture: claims.picture }
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

  const profilePatch: Record<string, string> = {
    id: userId,
    line_user_id: lineUser.sub,
    display_name: lineUser.name ?? existing?.display_name ?? 'Player',
  }
  if (lineUser.picture) profilePatch.avatar_url = lineUser.picture

  const { error: profileErr } = existing
    ? await admin.from('profiles').update(profilePatch).eq('id', userId)
    : await admin.from('profiles').upsert(profilePatch)
  if (profileErr) throw profileErr

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
    profile_id: userId,
    access_token: session.session?.access_token,
    refresh_token: session.session?.refresh_token,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { id_token, access_token, profile, link_token } = (await req.json()) as {
      id_token?: string
      access_token?: string
      profile?: LineProfileInput
      link_token?: string
    }

    if (!id_token || !link_token) {
      return new Response(JSON.stringify({ error: 'Missing id_token or link_token' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const channelId = Deno.env.get('LINE_CHANNEL_ID') ?? ''
    if (!channelId) {
      return new Response(JSON.stringify({ error: 'LINE channel not configured' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const tokenUser = await lineUserFromIdToken(id_token, channelId)
    if (!tokenUser) {
      return new Response(JSON.stringify({ error: 'Invalid LINE token' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const apiProfile =
      typeof access_token === 'string' && access_token.length > 0
        ? await lineProfileFromAccessToken(access_token)
        : null

    const lineUser: LineUser = {
      sub: tokenUser.sub,
      name:
        apiProfile?.display_name?.trim() ||
        profile?.display_name?.trim() ||
        tokenUser.name?.trim() ||
        undefined,
      picture: apiProfile?.picture_url || profile?.picture_url || tokenUser.picture || undefined,
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
