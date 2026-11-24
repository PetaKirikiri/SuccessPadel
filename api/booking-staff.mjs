import { createClient } from '@supabase/supabase-js';
import { completeKettSetup } from '../server/booking/kett-setup.mjs';

const cookie = '__Host-booking_staff';
const cookieAttributes = 'Path=/; Secure; HttpOnly; SameSite=Strict';

function writeSession(res, session) {
  const token = session?.access_token ?? '';
  const age = token ? Math.min(Number(session.expires_in) || 3600, 3600) : 0;
  const existing = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(existing ? [existing].flat() : []), `${cookie}=${token}; ${cookieAttributes}; Max-Age=${age}`]);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const send = (status, payload) => res.status(status).json(payload);
  if (!['GET', 'POST'].includes(req.method)) return send(405, {error: 'Method unavailable.'});
  if (req.method === 'POST' &&
      (!req.headers.host || req.headers.origin !== `https://${req.headers.host}` ||
       !/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? ''))) {
    return send(403, {error: 'Request denied.'});
  }

  const url = process.env.BOOKING_SUPABASE_URL;
  const key = process.env.BOOKING_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return send(503, {error: 'Staff sign-in unavailable.'});
  const token = req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(cookie + '='))?.slice(cookie.length + 1);
  const body = req.body ?? {};
  const action = req.method === 'GET' ? 'roster' : body.action;
  if (action === 'logout') {
    writeSession(res, null);
    return send(200, {});
  }

  const client = accessToken => createClient(url, key, {
    auth: {persistSession:false, autoRefreshToken:false, detectSessionInUrl:false},
    global: accessToken ? {headers:{Authorization:`Bearer ${accessToken}`}} : undefined,
  });
  async function staffRole(accessToken) {
    const {data, error} = await client(accessToken).from('booking_staff_access').select('role').maybeSingle();
    if (error) throw new Error('Staff access unavailable');
    return data?.role;
  }

  try {
    if (action === 'kett-setup') return await completeKettSetup(body, url, key, send);
    if (action === 'login') {
      if (typeof body.username !== 'string' || typeof body.password !== 'string') {
        return send(400, {error: 'Enter your username and password.'});
      }
      const username = body.username.trim().toLowerCase();
      const account = new Map([
        ['peta', {email:process.env.BOOKING_OWNER_EMAIL, role:'owner'}],
        ['kett', {email:'successpadelsamui@gmail.com', role:'owner'}],
        ['successpadel', {email:'booking-front-desk@successpadel.local', role:'front_desk'}],
      ]).get(username) ?? (/^[a-z][a-z0-9_-]{2,31}$/.test(username)
        ? {email:'successpadelsamui@gmail.com', role:'owner', chosenUsername:username} : null);
      if (!account?.email) return send(401, {error:'Staff sign-in failed.'});
      const {data, error} = await client().auth.signInWithPassword({email:account.email, password:body.password});
      if (error || !data.session || (account.chosenUsername && data.user?.app_metadata?.booking_username !== account.chosenUsername) ||
          (username === 'kett' && data.user?.app_metadata?.booking_username && data.user.app_metadata.booking_username !== username) ||
          await staffRole(data.session.access_token) !== account.role) {
        return send(401, {error: 'Staff sign-in failed.'});
      }
      writeSession(res, data.session);
      return send(200, {});
    }
    if (!token) return send(401, {error:'Sign in to continue.'});
    const db = client(token);
    const {data:{user}, error:userError} = await db.auth.getUser(token);
    if (userError || !user) {
      writeSession(res, null);
      return send(401, {error:'Sign in to continue.'});
    }
    const role = await staffRole(token);
    if (!role) return send(403, {error:'Staff access required.'});

    // The token has already been validated by Supabase Auth.
    const assurance = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).aal;
    if (role === 'owner' && assurance !== 'aal2') {
      const {data:googleVerified} = await db.rpc('booking_has_google_session');
      if (googleVerified !== true) {
        const factor = user.factors?.find(item => item.factor_type === 'totp' && item.status === 'verified');
        async function mfa(path, payload) {
          const response = await fetch(`${url}/auth/v1/factors${path}`, {
            method:'POST', headers:{apikey:key, Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
            body:JSON.stringify(payload),
          });
          if (!response.ok) throw new Error('Authenticator request failed');
          return response.json();
        }
        if (action === 'enroll' && !user.factors?.some(item => item.status === 'verified')) {
          const enrolled = await mfa('', {factor_type:'totp'});
          return send(200, {factorId:enrolled.id, secret:enrolled.totp.secret});
        }
        if (action === 'verify') {
          const factorId = factor?.id ?? body.factorId;
          if (!/^[\da-f-]{36}$/i.test(factorId ?? '') || !/^\d{6}$/.test(body.code ?? '')) {
            return send(400, {error:'Enter a six-digit code.'});
          }
          try {
            const challenge = await mfa('/' + factorId + '/challenge', {});
            const session = await mfa('/' + factorId + '/verify', {challenge_id:challenge.id, code:body.code});
            writeSession(res, session);
            return send(200, {});
          } catch {
            return send(400, {error:'Authenticator code was rejected.'});
          }
        }
        return send(403, {mfa:true, factorId:factor?.id ?? null, error:'Authenticator verification required.'});
      }
    }

    if (action === 'staff-password') {
      if (role !== 'owner') return send(403, {error:'Admin access required.'});
      const response = await fetch(`${url}/functions/v1/booking-front-desk-password`, {
        method:'POST',
        headers:{apikey:key, Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
        body:JSON.stringify({password:body.password}),
      });
      return send(response.status, await response.json());
    }

    if (action === 'roster' && req.query?.demo === 'samples') {
      if (role !== 'owner') return send(403, {error:'Owner access required.'});
      const {data, error} = await db.from('booking_demo_samples').select('dataset').eq('id',1).single();
      return error ? send(503, {error:'Could not load sample data.'}) : send(200, data.dataset);
    }

    if (action === 'roster') {
      const {data, error} = await db.from('booking_member_roster').select('members,revision').eq('id',1).single();
      if (error) return send(503, {error:'Could not load members.'});
      const profileName = role === 'front_desk' ? 'SuccessPadel' :
        user.email?.toLowerCase() === process.env.BOOKING_KETT_EMAIL?.toLowerCase() ? 'Kett' : 'Peta';
      const avatar = user.user_metadata?.avatar_url;
      const profile = {
        name:profileName,
        avatar:role === 'owner' && typeof avatar === 'string' &&
          /^https:\/\/lh3\.googleusercontent\.com\//.test(avatar) ? avatar : null,
      };
      return send(200, {...data, role, profile});
    }
    if (action === 'loan' || action === 'save-loan') {
      if (role !== 'owner') return send(403, {error:'Owner access required.'});
      const table = db.from('booking_coach_loan');
      if (action === 'loan') {
        const {data, error} = await table.select('ledger,revision').eq('id',1).single();
        return error ? send(503, {error:'Could not load the loan ledger.'}) : send(200, data);
      }
      const {ledger, revision} = body;
      if (!Array.isArray(ledger?.entries) || !Number.isInteger(revision) || revision < 0 ||
          revision >= 2147483647 || (ledger.adjustments !== undefined && !Array.isArray(ledger.adjustments))) {
        return send(400, {error:'Invalid loan ledger.'});
      }
      const {data, error} = await table.update({ledger, revision:revision+1}).eq('id',1)
        .eq('revision',revision).select('revision').maybeSingle();
      if (error) return send(503, {error:'Could not save the loan ledger.'});
      return data ? send(200, data) : send(409, {error:'Loan ledger changed. Reload and try again.'});
    }
    if (action === 'save') {
      const {members, revision} = body;
      if (!Array.isArray(members) || members.length > 10000 ||
          members.some(member => typeof member?.id !== 'string' || !member.id || typeof member.name !== 'string' || !member.name.trim()) ||
          new Set(members.map(member => member.id)).size !== members.length ||
          !Number.isInteger(revision) || revision < 0 || revision >= 2147483647) {
        return send(400, {error:'Invalid member records.'});
      }
      const {data, error} = await db.from('booking_member_roster').update({members, revision:revision+1})
        .eq('id',1).eq('revision',revision).select('revision').maybeSingle();
      if (error) return send(503, {error:'Could not save members.'});
      if (!data) return send(409, {error:'Members changed. Reload and try again.'});
      return send(200, data);
    }
    return send(400, {error:'Action unavailable.'});
  } catch {
    return send(503, {error:'Booking service unavailable.'});
  }
}
