import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const setupEmail = 'successpadelsamui@gmail.com';

const send = (status: number, data: object) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
const url = Deno.env.get('SUPABASE_URL')!;
const options = {auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false}};

Deno.serve(async request => {
  if (request.method !== 'POST') return send(405, {});
  const body = await request.json().catch(() => null);
  if (!body) return send(400, {});
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);
  if (body.action === 'create-invite') {
    const secret = Deno.env.get('BOOKING_KETT_INVITE_SECRET');
    if (!secret || request.headers.get('Authorization') !== 'Bearer ' + secret) return send(403, {});
    const {data,error} = await admin.auth.admin.generateLink({type:'invite',email:setupEmail});
    if (error || !data.properties.hashed_token) return send(409,{error:'Could not generate setup link.'});
    return send(200,{token:data.properties.hashed_token});
  }
  const auth = createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,options);
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const {token, password, confirmation} = body;
  if (!/^[a-z][a-z0-9_-]{2,31}$/.test(username) || ['peta', 'successpadel'].includes(username)) {
    return send(400, {error:'Choose a username with 3–32 letters, numbers, hyphens or underscores.'});
  }
  if (typeof password !== 'string' || password.length < 14 || password.length > 72 ||
      new TextEncoder().encode(password).length > 72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) || !/[^a-z0-9\s]/i.test(password)) {
    return send(400, {error:'Use 14 or more characters with uppercase, lowercase, a number and a symbol.'});
  }
  if (password !== confirmation) return send(400, {error:'Passwords must match.'});
  if (typeof token !== 'string' || !/^[a-z0-9_-]{20,256}$/i.test(token)) {
    return send(400, {error:'Open a valid account setup link.'});
  }
  const {data, error} = await auth.auth.verifyOtp({token_hash:token, type:'invite'});
  const user = data?.user;
  if (error || !user?.invited_at || user.email?.toLowerCase() !== setupEmail || user.app_metadata?.booking_username) {
    return send(403, {error:'This setup link is invalid or expired.'});
  }

  const {error:roleError} = await admin.from('booking_staff_access')
    .upsert({user_id:user.id, role:'owner'}, {onConflict:'user_id', ignoreDuplicates:true});
  if (roleError) return send(503,{error:'Could not activate booking access.'});
  const {error:updateError} = await admin.auth.admin.updateUserById(user.id, {
    password, app_metadata:{...user.app_metadata, booking_username:username},
  });
  if (updateError) return send(503,{error:'Could not finish setup. Request a new link.'});
  return send(200, {});
});
