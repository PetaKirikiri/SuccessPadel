import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';

export const accessCookie = '__Host-booking_staff';
export const rememberCookie = '__Host-booking_remember';
export const returningCookie = '__Host-booking_returning';
export const ownerLifetime = 5 * 3600;
export const staffLifetime = 30 * 86400;

export function readCookie(req, name) {
  return req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(name + '='))?.slice(name.length + 1);
}

function writeCookie(res, name, value, age) {
  const previous = res.getHeader('Set-Cookie') ?? [];
  res.setHeader('Set-Cookie', [...[previous].flat(),
    `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(age))}`]);
}

function key() {
  const secret = process.env.BOOKING_GOOGLE_SESSION_KEY;
  if (!secret) throw new Error('Booking session configuration unavailable.');
  return createHash('sha256').update('booking-remember-v1\0').update(secret).digest();
}

export function readRemembered(value) {
  if (!value || value.length > 4096) return null;
  const encryptionKey = key();
  try {
    const bytes = Buffer.from(value, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', encryptionKey, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
  } catch { return null; }
}

export function claimsOf(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

export function beginRemembered(session, role, ownerProof, now) {
  const claims = claimsOf(session.access_token);
  if (!claims.session_id || !session.refresh_token || !['owner','front_desk'].includes(role)) {
    throw new Error('Invalid booking session.');
  }
  return {role, ownerProof, sid:claims.session_id,
    until:now + (role === 'owner' ? ownerLifetime : staffLifetime)};
}

export function saveBrowserSession(res, session, state, now) {
  const claims = claimsOf(session.access_token);
  if (claims.session_id !== state.sid || !session.refresh_token || state.until <= now) {
    throw new Error('Invalid renewed session.');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({...state, refresh:session.refresh_token})), cipher.final()]);
  const remembered = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  // Renew before the one-hour owner database proof or access token expires.
  writeCookie(res, accessCookie, session.access_token, Math.min(3300, claims.exp - now - 60, state.until - now));
  writeCookie(res, rememberCookie, remembered, state.until - now);
  writeCookie(res, returningCookie, '1', staffLifetime);
}

export function clearBrowserSession(res, signOut = false) {
  writeCookie(res, accessCookie, '', 0);
  writeCookie(res, rememberCookie, '', 0);
  if (signOut) writeCookie(res, returningCookie, '', 0);
}
