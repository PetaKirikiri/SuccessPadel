import {createHash, createHmac, randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const nonceCookie = '__Host-booking_google_nonce';
const cookieAttributes = 'Path=/; Secure; HttpOnly; SameSite=Strict';
const googleClientId = '924798055254-tm25nh3dtlhharjesk99l47bcrurhi68.apps.googleusercontent.com';

export function beginBookingGoogle(res) {
  const nonce = randomBytes(32).toString('hex');
  res.setHeader('Set-Cookie', `${nonceCookie}=${nonce}; ${cookieAttributes}; Max-Age=900`);
  return res.status(200).json({clientId:googleClientId, nonce:hashNonce(nonce)});
}

function hashNonce(nonce) {
  return createHash('sha256').update(nonce).digest('hex');
}

function claimsFrom(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
}

export async function completeBookingGoogle(req, res, url, key, writeSession) {
  const signingKey = process.env.BOOKING_GOOGLE_SESSION_KEY;
  const allowed = [process.env.BOOKING_OWNER_EMAIL, process.env.BOOKING_KETT_EMAIL]
    .filter(Boolean).map(email => email.trim().toLowerCase());
  const nonce = req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(nonceCookie + '='))?.slice(nonceCookie.length + 1);
  const credential = req.body?.credential;
  if (!signingKey || !allowed.length || req.headers.host !== 'successpadel.app') {
    return res.status(503).json({error:'Google sign-in unavailable.'});
  }
  res.setHeader('Set-Cookie', `${nonceCookie}=; ${cookieAttributes}; Max-Age=0`);
  if (!/^[a-f0-9]{64}$/.test(nonce ?? '') || typeof credential !== 'string' || credential.length > 8192) {
    return res.status(400).json({error:'Reload the page and try Google sign-in again.'});
  }

  let step = 'identity';
  try {
    // These checks reject irrelevant tokens early. Supabase verifies the signature below.
    const identity = claimsFrom(credential);
    const email = typeof identity.email === 'string' ? identity.email.toLowerCase() : '';
    if (!allowed.includes(email) || identity.email_verified !== true) {
      return res.status(403).json({error:'Select an approved Bookings admin Google account.'});
    }
    if (identity.aud !== googleClientId || identity.nonce !== hashNonce(nonce) ||
        !['https://accounts.google.com','accounts.google.com'].includes(identity.iss) ||
        (email !== 'successpadelsamui@gmail.com' && identity.hd !== email.split('@')[1])) {
      return res.status(401).json({error:'Google could not verify this sign-in.'});
    }

    step = 'supabase-token';
    const auth = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const {data,error} = await auth.auth.signInWithIdToken({provider:'google',token:credential,nonce});
    const {session} = data ?? {};
    if (error || !session) {
      console.warn('booking_google_token_rejected', {status:error?.status, code:error?.code});
      return res.status(401).json({error:'Google sign-in could not be verified. Try again.'});
    }
    step = 'provider-link';
    const {data:account,error:accountError} = await auth.auth.getUser(session.access_token);
    const user = account?.user;
    const linked = user?.identities?.some(item => item.provider === 'google' &&
      (item.identity_data?.sub === identity.sub || item.id === identity.sub));
    if (accountError || !user || !linked || user.email?.toLowerCase() !== email) {
      console.warn('booking_google_identity_mismatch', {
        accountFound:Boolean(user), emailMatches:user?.email?.toLowerCase() === email,
        hasGoogleIdentity:Boolean(user?.identities?.some(item => item.provider === 'google')),
        subjectMatches:Boolean(linked),
      });
      throw new Error('Google identity mismatch');
    }

    step = 'booking-session';
    const claims = claimsFrom(session.access_token);
    if (!claims.session_id || claims.sub !== user.id) throw new Error('Invalid session binding');
    const expires = Math.min(claims.exp, Math.floor(Date.now()/1000) + 3500);
    const proof = createHmac('sha256',signingKey).update(`booking-google-v1:${user.id}:${claims.session_id}:${expires}`).digest('hex');
    const db = createClient(url,key,{accessToken:async()=>session.access_token});
    const {data:accepted, error:proofError} = await db.rpc('booking_accept_google_session',{proof,expires});
    if (proofError || accepted !== true) throw new Error('Booking access denied');
    writeSession(res,session);
    return res.status(200).json({});
  } catch {
    console.warn('booking_google_signin_failed', {step});
    return res.status(401).json({error:'Google sign-in failed. Try again.'});
  }
}
