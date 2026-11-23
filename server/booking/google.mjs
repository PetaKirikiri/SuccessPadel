import {createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const callback = 'https://successpadel.app/api/booking-staff?google=callback';
const verifierCookie = '__Host-booking_google';
const verifierAttributes = 'Path=/; Secure; HttpOnly; SameSite=Lax';

export async function bookingGoogle(req, res, url, key, writeSession) {
  const signingKey = process.env.BOOKING_GOOGLE_SESSION_KEY;
  const allowed = [process.env.BOOKING_OWNER_EMAIL, process.env.BOOKING_KETT_EMAIL]
    .filter(Boolean).map(email => email.trim().toLowerCase());
  if (!signingKey || !allowed.length || req.headers.host !== 'successpadel.app') {
    return res.redirect(303, '/booking/?signin=google-unavailable');
  }
  const verifier = req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(verifierCookie + '='))?.slice(verifierCookie.length + 1);
  let nextVerifier;
  const auth = createClient(url, key, {auth:{
    flowType:'pkce', persistSession:true, autoRefreshToken:false, detectSessionInUrl:false,
    storage:{
      getItem:name => name.endsWith('-code-verifier') && verifier ? decodeURIComponent(verifier) : null,
      setItem:(name, value) => {if (name.endsWith('-code-verifier')) nextVerifier = value;},
      removeItem:() => {},
    },
  }});
  if (req.query.google === 'start') {
    const {data, error} = await auth.auth.signInWithOAuth({
      provider:'google', options:{redirectTo:callback, skipBrowserRedirect:true, queryParams:{prompt:'select_account'}},
    });
    if (!error && data.url && /^[\w"\-./]+$/.test(nextVerifier ?? '')) {
      res.setHeader('Set-Cookie', `${verifierCookie}=${encodeURIComponent(nextVerifier)}; ${verifierAttributes}; Max-Age=600`);
      return res.redirect(303, data.url);
    }
    return res.redirect(303, '/booking/?signin=google-error');
  }
  res.setHeader('Set-Cookie', `${verifierCookie}=; ${verifierAttributes}; Max-Age=0`);
  if (req.query.google !== 'callback' || typeof req.query.code !== 'string' || !verifier) {
    return res.redirect(303, '/booking/?signin=google-error');
  }
  try {
    const {data:{session}, error} = await auth.auth.exchangeCodeForSession(req.query.code);
    if (error || !session?.provider_token) throw new Error('Missing Google session');
    const {data:{user}, error:userError} = await auth.auth.getUser(session.access_token);
    if (userError || !user) throw new Error('Invalid staff session');
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers:{Authorization:`Bearer ${session.provider_token}`},
    });
    if (!response.ok) throw new Error('Google identity unavailable');
    const identity = await response.json();
    const email = typeof identity.email === 'string' ? identity.email.toLowerCase() : '';
    const linked = user.identities?.some(item => item.provider === 'google' && item.identity_data?.sub === identity.sub);
    if (identity.email_verified !== true || !allowed.includes(email) || user.email?.toLowerCase() !== email || !linked) {
      return res.redirect(303, '/booking/?signin=google-denied');
    }
    const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url'));
    if (!claims.session_id || claims.sub !== user.id) throw new Error('Invalid session binding');
    const expires = Math.min(claims.exp, Math.floor(Date.now()/1000) + 3500);
    const proof = createHmac('sha256',signingKey).update(`booking-google-v1:${user.id}:${claims.session_id}:${expires}`).digest('hex');
    const db = createClient(url,key,{accessToken:async()=>session.access_token});
    const {data:accepted, error:proofError} = await db.rpc('booking_accept_google_session',{proof,expires});
    if (proofError || accepted !== true) throw new Error('Booking access denied');
    writeSession(res,session);
    return res.redirect(303, '/booking/');
  } catch {
    return res.redirect(303, '/booking/?signin=google-error');
  }
}
