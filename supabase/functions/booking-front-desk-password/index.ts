import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const sharedEmail = 'booking-front-desk@successpadel.local'
const sessionOptions = { auth: { persistSession: false, autoRefreshToken: false } }

Deno.serve(async (request) => {
  const send = (status: number, payload: Record<string, unknown>) =>
    Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } })
  if (request.method !== 'POST') return send(405, { error: 'Method unavailable.' })

  const token = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1]
  if (!token) return send(401, { error: 'Sign in to continue.' })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      ...sessionOptions,
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error } = await caller.auth.getUser(token)
    if (error || !user) return send(401, { error: 'Sign in again.' })

    const { data: access } = await caller.from('booking_staff_access').select('role')
      .eq('user_id', user.id).maybeSingle()
    if (access?.role !== 'owner') return send(403, { error: 'Admin access required.' })

    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const { data: google } = await caller.rpc('booking_has_google_session')
    if (claims.aal !== 'aal2' && google !== true) {
      return send(403, { error: 'Verify your admin sign-in.' })
    }

    const body = await request.json().catch(() => null)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, sessionOptions)
    const { data: accessRows, error: accessError } = await admin.from('booking_staff_access')
      .select('user_id,role')
    if (accessError) throw accessError
    const accounts = await Promise.all(accessRows.map(async ({user_id, role}) => {
      const {data, error} = await admin.auth.admin.getUserById(user_id)
      if (error || !data.user) throw new Error('Account unavailable')
      return {user: data.user, role}
    }))
    const shared = accounts.find(({user}) => user.email === sharedEmail)
    if (body?.action === 'list') {
      return send(200, {accounts: accounts.map(({user, role}) => ({
        id: user.id,
        role,
        name: user.email === sharedEmail ? 'SuccessPadel' : role === 'owner'
          ? user.email === 'successpadelsamui@gmail.com' ? 'Kett' : 'Peta'
          : user.app_metadata.booking_display_name ?? user.app_metadata.booking_staff_username ?? 'Staff',
        username: user.email === sharedEmail ? 'SuccessPadel' :
          user.app_metadata.booking_staff_username ?? user.app_metadata.booking_username ??
          (role === 'owner' && user.email !== 'successpadelsamui@gmail.com' ? 'Peta' : null),
        shared: user.email === sharedEmail,
      }))})
    }

    const password = body?.password
    if (typeof password !== 'string' || password.length < 12 ||
        new TextEncoder().encode(password).length > 72 || password.trim() !== password) {
      return send(400, { error: 'Use 12–72 characters with no spaces at the start or end.' })
    }

    if (body?.action === 'create') {
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!/^[a-z][a-z0-9_-]{2,31}$/.test(username) || !name || name.length > 60) {
        return send(400, {error:'Enter a name and a username with 3–32 letters, numbers, underscores or hyphens.'})
      }
      if (['peta','kett','successpadel'].includes(username) || accounts.some(({user}) =>
        user.app_metadata.booking_username === username || user.app_metadata.booking_staff_username === username)) {
        return send(409, {error:'That username is already in use.'})
      }
      const {data, error} = await admin.auth.admin.createUser({
        email: username+'@staff.successpadel.local', email_confirm: true, password,
        app_metadata: {booking_staff_username:username, booking_display_name:name},
      })
      if (error?.code === 'email_exists') return send(409, {error:'That username is already in use.'})
      if (error?.code === 'weak_password') return send(400, {error:'Choose a stronger password.'})
      if (error || !data.user) throw new Error('Could not create staff user')
      const {error: assignmentError} = await admin.from('booking_staff_access')
        .insert({user_id:data.user.id, role:'front_desk'})
      if (assignmentError) {
        await admin.auth.admin.deleteUser(data.user.id)
        throw assignmentError
      }
      return send(201, {})
    }

    if (body?.action === 'reset') {
      const target = accounts.find(({user, role}) => user.id === body.id && role === 'front_desk' &&
        typeof user.app_metadata.booking_staff_username === 'string' &&
        user.email === user.app_metadata.booking_staff_username+'@staff.successpadel.local')
      if (!target) return send(404, {error:'Staff account unavailable.'})
      const {error} = await admin.auth.admin.updateUserById(target.user.id, {password})
      if (error?.code === 'weak_password') return send(400, {error:'Choose a stronger password.'})
      if (error && error.code !== 'same_password') throw error
      return send(200, {})
    }
    if (body?.action) return send(400, {error:'Invalid account action.'})
    let staffId = shared?.user.id
    let createdNow = false

    if (!staffId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: sharedEmail, email_confirm: true, password,
        app_metadata: { booking_front_desk: true },
      })
      if (!createError && created.user) {
        staffId = created.user.id
        createdNow = true
      } else if (createError?.code === 'weak_password') {
        return send(400, { error: 'Choose a stronger password.' })
      } else if (createError?.code === 'email_exists') {
        // Recover if account creation succeeded and assigning its role was interrupted.
        for (let page = 1; page <= 50 && !staffId; page++) {
          const { data, error: lookupError } = await admin.auth.admin.listUsers({page, perPage:200})
          if (lookupError) throw lookupError
          const existing = data.users.find((account) => account.email === sharedEmail)
          if (existing) {
            if (existing.app_metadata.booking_front_desk !== true) throw new Error('Email already in use')
            staffId = existing.id
          }
          if (data.users.length < 200) break
        }
      }
    }

    if (!staffId) throw new Error('Could not find the front desk account')
    const { data: staff, error: staffError } = await admin.auth.admin.getUserById(staffId)
    if (staffError || staff.user?.email !== sharedEmail ||
        staff.user.app_metadata.booking_front_desk !== true) {
      throw new Error('Unexpected front desk account')
    }
    const { data: assignedRole, error: roleError } = await admin.from('booking_staff_access')
      .select('role').eq('user_id', staffId).maybeSingle()
    if (roleError || (assignedRole && assignedRole.role !== 'front_desk')) {
      throw new Error('Unexpected front desk role')
    }

    if (!createdNow) {
      const { error: updateError } = await admin.auth.admin.updateUserById(staffId, { password })
      if (updateError?.code === 'weak_password') return send(400, { error: 'Choose a stronger password.' })
      if (updateError && updateError.code !== 'same_password') throw updateError
    }
    const { error: saveError } = await admin.from('booking_staff_access')
      .upsert({ user_id: staffId, role: 'front_desk' }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (saveError) throw saveError
    return send(200, {})
  } catch {
    return send(503, { error: 'Could not manage staff accounts. Try again.' })
  }
})
