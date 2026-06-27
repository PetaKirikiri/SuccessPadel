import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAYER_EMAIL_DOMAIN = 'players.successpadel.app'

function normalizeUsername(username: string): string {
  return username.trim().replace(/\s+/g, ' ')
}

function loginComparable(value: string): string {
  return normalizeUsername(value).toLocaleLowerCase()
}

function usernameEmailLocalPart(username: string): string {
  const ascii = username
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')

  return ascii || `player-${Array.from(username).map((char) => char.codePointAt(0)?.toString(36) ?? '').join('')}`
}

function browserPlayerEmail(username: string): string {
  return `${usernameEmailLocalPart(username)}@${PLAYER_EMAIL_DOMAIN}`
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | undefined> {
  const needle = email.toLowerCase()
  for (let page = 1; page <= 20; page += 1) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = list.users.find((u) => u.email?.toLowerCase() === needle)
    if (found?.id) return found.id
    if (list.users.length < 200) break
  }
  return undefined
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

async function sessionForUser(admin: ReturnType<typeof createClient>, userId: string, fallbackEmail: string) {
  const linkEmail = await magicLinkEmailForUser(admin, userId, fallbackEmail)
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
    access_token: session.session?.access_token,
    refresh_token: session.session?.refresh_token,
  }
}

async function findProfileByDisplayName(admin: ReturnType<typeof createClient>, username: string) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, display_name, avatar_url, line_user_id')
    .ilike('display_name', username)
    .limit(10)
  if (error) throw error

  const normalized = username.toLocaleLowerCase()
  const exact = (data ?? []).filter(
    (profile) => String(profile.display_name ?? '').toLocaleLowerCase() === normalized,
  )
  exact.sort((a, b) => {
    const aLine = a.line_user_id ? 0 : 1
    const bLine = b.line_user_id ? 0 : 1
    return aLine - bLine
  })
  return exact[0] ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { username: rawUsername, password: rawPassword } = (await req.json()) as {
      username?: string
      password?: string
    }
    const username = normalizeUsername(rawUsername ?? '')
    const password = rawPassword ?? username

    if (!username) {
      return new Response(JSON.stringify({ error: 'Enter your username.' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (loginComparable(password) !== loginComparable(username)) {
      return new Response(JSON.stringify({ error: 'Temporary password must match the username.' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const fallbackEmail = browserPlayerEmail(username)
    const existingProfile = await findProfileByDisplayName(admin, username)
    let userId = existingProfile?.id as string | undefined
    let createdNewUser = false

    if (!userId) {
      userId = await findAuthUserIdByEmail(admin, fallbackEmail)
    }

    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: fallbackEmail,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: username,
          name: username,
          browser_player_username: username,
        },
      })
      if (error) throw error
      userId = created.user.id
      createdNewUser = true
    } else {
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId)
      if (authErr) throw authErr
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          ...(authUser.user.user_metadata ?? {}),
          display_name: username,
          name: username,
          browser_player_username: username,
        },
      })
      if (updateErr) throw updateErr
    }

    if (existingProfile) {
      const patch: Record<string, string> = {}
      if (!existingProfile.display_name || existingProfile.display_name === 'Player') {
        patch.display_name = username
      }
      if (Object.keys(patch).length > 0) {
        const { error } = await admin.from('profiles').update(patch).eq('id', userId)
        if (error) throw error
      }
    } else {
      const { error } = await admin.from('profiles').upsert({
        id: userId,
        display_name: username,
      })
      if (error) throw error
    }

    await admin
      .from('padel_players')
      .update({ profile_id: userId, linked_at: new Date().toISOString() })
      .ilike('display_name', username)
      .is('profile_id', null)

    const session = await sessionForUser(admin, userId, fallbackEmail)

    return new Response(
      JSON.stringify({
        ...session,
        profile_id: userId,
        display_name: username,
        matched_existing_profile: Boolean(existingProfile),
        created_new_user: createdNewUser,
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
