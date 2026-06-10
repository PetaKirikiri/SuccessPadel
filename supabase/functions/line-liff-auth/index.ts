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

const BIA_LINE_USER_ID = 'U2131aeeeaaa787589d757995fb667e07'

function clubLineDisplayName(sub: string, name?: string): string | undefined {
  if (sub === BIA_LINE_USER_ID) return 'Bia'
  return name
}

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

async function lineProfileFromUserinfo(accessToken: string): Promise<LineProfileInput | null> {
  const res = await fetch('https://api.line.me/oauth2/v2.1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null

  const data = (await res.json()) as { sub?: string; name?: string; picture?: string }
  if (!data.sub || !data.name?.trim()) return null

  return {
    user_id: data.sub,
    display_name: data.name.trim(),
    picture_url: data.picture,
  }
}

async function lineUserFromIdToken(idToken: string, channelId: string): Promise<LineUser | null> {
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
    }),
  })

  if (!verifyRes.ok) return null

  const claims = (await verifyRes.json()) as {
    sub?: string
    name?: string
    picture?: string
  }
  if (!claims.sub) return null
  return { sub: claims.sub, name: claims.name, picture: claims.picture }
}

function mergeLineUser(
  tokenUser: LineUser,
  apiProfile?: LineProfileInput | null,
  clientProfile?: LineProfileInput,
): LineUser {
  for (const profile of [apiProfile, clientProfile]) {
    if (profile?.user_id && profile.user_id !== tokenUser.sub) {
      throw new Error('LINE profile does not match signed-in user')
    }
  }

  const name =
    apiProfile?.display_name?.trim() ||
    clientProfile?.display_name?.trim() ||
    tokenUser.name?.trim() ||
    undefined
  const picture =
    apiProfile?.picture_url || clientProfile?.picture_url || tokenUser.picture || undefined
  return { sub: tokenUser.sub, name, picture }
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

async function sessionForLineUser(admin: ReturnType<typeof createClient>, lineUser: LineUser) {
  lineUser = { ...lineUser, name: clubLineDisplayName(lineUser.sub, lineUser.name) }
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
  }
  if (lineUser.name) {
    profilePatch.display_name = lineUser.name
  } else if (!existing?.display_name || existing.display_name === 'Player') {
    profilePatch.display_name = existing?.display_name ?? 'Player'
  }

  if (lineUser.picture) profilePatch.avatar_url = lineUser.picture

  if (existing) {
    const { error: profileErr } = await admin.from('profiles').update(profilePatch).eq('id', userId)
    if (profileErr) throw profileErr
  } else {
    const { error: profileErr } = await admin.from('profiles').upsert(profilePatch)
    if (profileErr) throw profileErr
  }

  if (lineUser.name || lineUser.picture) {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        display_name: lineUser.name ?? existing?.display_name ?? 'Player',
        avatar_url: lineUser.picture ?? existing?.avatar_url ?? null,
        line_user_id: lineUser.sub,
      },
    })
  }

  const linkEmail = await magicLinkEmailForUser(admin, userId, email)
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: linkEmail,
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
    display_name: lineUser.name,
    avatar_url: lineUser.picture,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { id_token, access_token, profile } = (await req.json()) as {
      id_token?: string
      access_token?: string
      profile?: LineProfileInput
    }
    if (!id_token) {
      return new Response(JSON.stringify({ error: 'Missing id_token' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const channelId = Deno.env.get('LINE_CHANNEL_ID') ?? ''
    if (!channelId) {
      return new Response(JSON.stringify({ error: 'LINE channel not configured on server' }), {
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

    const hasAccessToken = typeof access_token === 'string' && access_token.length > 0
    const apiProfile = hasAccessToken ? await lineProfileFromAccessToken(access_token) : null
    const userinfoProfile =
      hasAccessToken && !apiProfile ? await lineProfileFromUserinfo(access_token) : null

    const lineUser = mergeLineUser(tokenUser, apiProfile ?? userinfoProfile, profile)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const session = await sessionForLineUser(admin, lineUser)

    return new Response(
      JSON.stringify({
        ...session,
        profile_resolved: Boolean(lineUser.name),
        profile_sources: {
          api_profile: Boolean(apiProfile?.display_name),
          userinfo: Boolean(userinfoProfile?.display_name),
          client_profile: Boolean(profile?.display_name),
          token_name: Boolean(tokenUser.name),
          had_access_token: hasAccessToken,
        },
      }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' },
      },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
