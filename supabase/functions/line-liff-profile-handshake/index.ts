import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { lineAuthEmail, normalizeLineUserId } from '../_shared/lineUserId.ts'

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
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  })
  if (!verifyRes.ok) return null
  const claims = (await verifyRes.json()) as { sub?: string; name?: string; picture?: string }
  if (!claims.sub) return null
  return { sub: claims.sub, name: claims.name, picture: claims.picture }
}

async function lineUserFromAccessToken(accessToken: string): Promise<LineUser | null> {
  const apiProfile = await lineProfileFromAccessToken(accessToken)
  if (apiProfile?.user_id) {
    return {
      sub: apiProfile.user_id,
      name: apiProfile.display_name,
      picture: apiProfile.picture_url,
    }
  }
  const userinfo = await lineProfileFromUserinfo(accessToken)
  if (userinfo?.user_id) {
    return {
      sub: userinfo.user_id,
      name: userinfo.display_name,
      picture: userinfo.picture_url,
    }
  }
  return null
}

function mergeLineUser(
  tokenUser: LineUser,
  apiProfile?: LineProfileInput | null,
  clientProfile?: LineProfileInput,
): LineUser {
  tokenUser = { ...tokenUser, sub: normalizeLineUserId(tokenUser.sub) }
  for (const profile of [apiProfile, clientProfile]) {
    if (profile?.user_id && normalizeLineUserId(profile.user_id) !== tokenUser.sub) {
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

async function sessionForProfileId(
  admin: ReturnType<typeof createClient>,
  profileId: string,
  lineUser: LineUser,
) {
  const lineSub = normalizeLineUserId(lineUser.sub)
  const email = lineAuthEmail(lineSub)

  const { data: existing, error: loadErr } = await admin
    .from('profiles')
    .select('id, display_name, avatar_url, line_user_id')
    .eq('id', profileId)
    .maybeSingle()
  if (loadErr) throw loadErr
  if (!existing?.id) throw new Error('Profile not found')

  const profilePatch: Record<string, string | null> = {
    line_user_id: lineSub,
    display_name: lineUser.name ?? existing.display_name ?? 'Player',
    avatar_url: lineUser.picture ?? existing.avatar_url ?? null,
  }
  const { error: profileErr } = await admin.from('profiles').update(profilePatch).eq('id', profileId)
  if (profileErr) throw profileErr

  let userId = profileId
  const { error: userErr } = await admin.auth.admin.getUserById(profileId)
  if (userErr) {
    const { data: created, error } = await admin.auth.admin.createUser({
      id: profileId,
      email,
      email_confirm: true,
      user_metadata: {
        display_name: profilePatch.display_name,
        avatar_url: profilePatch.avatar_url,
        line_user_id: lineSub,
      },
    })
    if (error) {
      const { data: list } = await admin.auth.admin.listUsers()
      userId =
        list.users.find(
          (u) =>
            u.id === profileId ||
            u.email?.toLowerCase() === email ||
            normalizeLineUserId(String(u.user_metadata?.line_user_id ?? '')) === lineSub,
        )?.id ?? profileId
    } else {
      userId = created.user.id
    }
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
    profile_id: profileId,
    access_token: session.session?.access_token,
    refresh_token: session.session?.refresh_token,
  }
}

async function sessionForLineUser(admin: ReturnType<typeof createClient>, lineUser: LineUser) {
  const lineSub = normalizeLineUserId(lineUser.sub)
  lineUser = { ...lineUser, sub: lineSub }
  const email = lineAuthEmail(lineSub)

  const { data: existing } = await admin
    .from('profiles')
    .select('id, display_name, avatar_url')
    .ilike('line_user_id', lineSub)
    .maybeSingle()

  let userId = existing?.id as string | undefined

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: lineUser.name ?? 'Player',
        avatar_url: lineUser.picture,
        line_user_id: lineSub,
      },
    })
    if (error) {
      const { data: list } = await admin.auth.admin.listUsers()
      const found = list.users.find(
        (u) =>
          u.email?.toLowerCase() === email ||
          normalizeLineUserId(String(u.user_metadata?.line_user_id ?? '')) === lineSub,
      )
      userId = found?.id
      if (!userId) throw error
    } else {
      userId = created.user.id
    }
  }

  const profilePatch: Record<string, string> = {
    id: userId,
    line_user_id: lineSub,
  }
  if (lineUser.name && (!existing?.display_name || existing.display_name === 'Player')) {
    profilePatch.display_name = lineUser.name
  }
  if (
    lineUser.picture &&
    (!existing?.avatar_url || existing.avatar_url.includes('profile.line-scdn.net'))
  ) {
    profilePatch.avatar_url = lineUser.picture
  }

  if (existing) {
    await admin.from('profiles').update(profilePatch).eq('id', userId)
  } else {
    await admin.from('profiles').upsert({
      ...profilePatch,
      display_name: lineUser.name ?? 'Player',
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
    profile_id: userId,
    access_token: session.session?.access_token,
    refresh_token: session.session?.refresh_token,
    had_existing_profile: Boolean(existing),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { id_token, access_token, profile, padel_player_id } = (await req.json()) as {
      id_token?: string
      access_token?: string
      profile?: LineProfileInput
      padel_player_id?: string
    }

    if (!id_token) {
      return new Response(JSON.stringify({ error: 'Missing id_token' }), {
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

    const hasAccessToken = typeof access_token === 'string' && access_token.length > 0
    let tokenUser = await lineUserFromIdToken(id_token, channelId)
    const idTokenVerifyFailed = !tokenUser
    if (!tokenUser && hasAccessToken) {
      tokenUser = await lineUserFromAccessToken(access_token)
    }
    if (!tokenUser) {
      return new Response(JSON.stringify({ error: 'Invalid LINE token' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const apiProfile = hasAccessToken ? await lineProfileFromAccessToken(access_token) : null
    const userinfoProfile =
      hasAccessToken && !apiProfile ? await lineProfileFromUserinfo(access_token) : null
    const lineUser = mergeLineUser(tokenUser, apiProfile ?? userinfoProfile, profile)
    const lineSub = lineUser.sub

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: registeredProfile } = await admin
      .from('profiles')
      .select('id')
      .ilike('line_user_id', lineSub)
      .maybeSingle()

    let stubProfileId: string | null = null
    if (!registeredProfile && padel_player_id) {
      const { data: linkable } = await admin.rpc('padel_player_still_linkable', {
        p_padel_player_id: padel_player_id,
      })
      if (linkable) {
        const { data: padelRow } = await admin
          .from('padel_players')
          .select('profile_id')
          .eq('id', padel_player_id)
          .maybeSingle()
        if (padelRow?.profile_id) {
          const { data: prof } = await admin
            .from('profiles')
            .select('id, line_user_id')
            .eq('id', padelRow.profile_id)
            .maybeSingle()
          if (prof?.id && !prof.line_user_id) stubProfileId = prof.id
        }
      }
    }

    const session = stubProfileId
      ? await sessionForProfileId(admin, stubProfileId, lineUser)
      : await sessionForLineUser(admin, lineUser)
    if (!session.access_token || !session.refresh_token || !session.profile_id) {
      return new Response(JSON.stringify({ error: 'Could not create session' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    let mode: 'login' | 'connected' = 'login'

    if (!registeredProfile && padel_player_id) {
      const { data: linkable } = await admin.rpc('padel_player_still_linkable', {
        p_padel_player_id: padel_player_id,
      })
      if (linkable) {
        const { error: linkErr } = await admin.rpc('link_padel_player_direct', {
          p_padel_player_id: padel_player_id,
          p_profile_id: session.profile_id,
          p_line_user_id: lineSub,
          p_line_display_name: lineUser.name ?? null,
          p_line_picture_url: lineUser.picture ?? null,
        })
        if (linkErr) {
          return new Response(JSON.stringify({ error: linkErr.message }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          })
        }
        mode = 'connected'
      }
    }

    return new Response(
      JSON.stringify({
        mode,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        profile_id: session.profile_id,
        padel_player_id: padel_player_id ?? null,
        line_sub_normalized: lineSub,
        id_token_verify_failed: idTokenVerifyFailed,
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
