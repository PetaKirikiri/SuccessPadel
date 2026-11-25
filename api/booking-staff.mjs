import {applyLessonChanges,sendLessonNotices} from '../server/booking/lesson-events.mjs';
const lineTestMemberId = 'padel-card-012';
function bookingNotificationPreferences(members) {
  return members.map(member => ({...member, lineBookingNotificationsEnabled: !member.deleted && member.lineBookingNotificationsEnabled === true}));
}
import { createClient } from '@supabase/supabase-js';
import { completeKettSetup } from '../server/booking/kett-setup.mjs';

import { authorizeBookingOwnerSession } from '../server/booking/google.mjs';

import {accessCookie, rememberCookie, returningCookie, beginRemembered, claimsOf, clearBrowserSession,
  ownerLifetime, readCookie, readRemembered, saveBrowserSession} from '../server/booking/browser-session.mjs';

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
  let token = readCookie(req, accessCookie);
  const returning = readCookie(req, returningCookie) === '1';
  const now = Math.floor(Date.now() / 1000);
  const body = req.body ?? {};
  const action = req.method === 'GET' ? 'roster' : body.action;
  const expired = () => {
    clearBrowserSession(res);
    return send(401, {returning, error:'Sign in to continue.'});
  };

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
    const encoded = readCookie(req, rememberCookie);
    let remembered = readRemembered(encoded);
    if (action === 'logout') {
      if (!token && remembered && remembered.until > now) {
        const refresh = await client().auth.refreshSession({refresh_token:remembered.refresh});
        if (refresh.error && (!refresh.error.status || refresh.error.status >= 500)) throw refresh.error;
        token = refresh.data.session?.access_token;
      }
      if (token) {
        const response = await fetch(url + '/auth/v1/logout?scope=local', {
          method:'POST', headers:{apikey:key, Authorization:'Bearer ' + token},
        });
        if (!response.ok && ![401,403,404].includes(response.status)) throw new Error('Sign-out unavailable.');
      }
      clearBrowserSession(res, true);
      return send(200, {});
    }
    if (action === 'kett-setup') return await completeKettSetup(body, url, key, send);
    if (action === 'login') {
      if (typeof body.username !== 'string' || typeof body.password !== 'string') {
        return send(400, {error: 'Enter your username and password.'});
      }
      const username = body.username.trim().toLowerCase();
      let account = new Map([
        ['peta', {email:process.env.BOOKING_OWNER_EMAIL, role:'owner'}],
        ['kett', {email:'successpadelsamui@gmail.com', role:'owner'}],
        ['successpadel', {email:'booking-front-desk@successpadel.local', role:'front_desk'}],
      ]).get(username) ?? (/^[a-z][a-z0-9_-]{2,31}$/.test(username)
        ? {email:'successpadelsamui@gmail.com', role:'owner', chosenUsername:username} : null);
      if (!account?.email) return send(401, {error:'Staff sign-in failed.'});
      let result;
      if (account.chosenUsername) {
        result = await client().auth.signInWithPassword({
          email:username+'@staff.successpadel.local', password:body.password,
        });
        if (result.data?.user?.app_metadata?.booking_staff_username === username && result.data.session) {
          account = {role:'front_desk'};
        } else {
          result = undefined;
        }
      }
      const {data, error} = result ?? await client().auth.signInWithPassword({email:account.email, password:body.password});
      if (error || !data.session || (account.chosenUsername && data.user?.app_metadata?.booking_username !== account.chosenUsername) ||
          (username === 'kett' && data.user?.app_metadata?.booking_username && data.user.app_metadata.booking_username !== username) ||
          await staffRole(data.session.access_token) !== account.role) {
        return send(401, {error: 'Staff sign-in failed.'});
      }
      const user = data.user;
      const kettVerified = account.role === 'owner' &&
        user?.email?.toLowerCase() === 'successpadelsamui@gmail.com' &&
        Boolean(user.email_confirmed_at) &&
        user.app_metadata?.booking_username === username &&
        user.identities?.some(identity => identity.provider === 'google');
      if (kettVerified || (username === 'peta' && user?.app_metadata?.booking_password_setup === true)) {
        await authorizeBookingOwnerSession(url,key,data.session,data.user.id);
      }
      remembered = beginRemembered(data.session, account.role, Boolean(kettVerified ||
        (username === 'peta' && user?.app_metadata?.booking_password_setup === true)), now);
      saveBrowserSession(res, data.session, remembered, now);
      return send(200, {});
    }
    if (encoded && (!remembered || remembered.until <= now)) return expired();
    let renewed;
    if (!token && remembered) {
      const result = await client().auth.refreshSession({refresh_token:remembered.refresh});
      if (result.error && (!result.error.status || result.error.status >= 500 || result.error.status === 429)) throw result.error;
      renewed = result.data.session;
      if (!renewed || claimsOf(renewed.access_token).session_id !== remembered.sid) return expired();
      token = renewed.access_token;
    }
    if (!token) return send(401, {returning, error:'Sign in to continue.'});
    const db = client(token);
    const {data:{user}, error:userError} = await db.auth.getUser(token);
    if (userError || !user) {
      if (userError && (!userError.status || userError.status >= 500 || userError.status === 429)) throw userError;
      return expired();
    }
    const role = await staffRole(token);
    if (!role) return send(403, {error:'Staff access required.'});

    // The token has already been validated by Supabase Auth.
    const claims = claimsOf(token);
    if (remembered && (remembered.role !== role || remembered.sid !== claims.session_id)) return expired();
    // Supabase signs the original authentication time in amr, including on refreshed tokens.
    const passwordTime = claims.amr?.find(entry => entry.method === 'password')?.timestamp;
    const ownerUntil = Math.min(remembered?.until ?? Infinity, (passwordTime ?? claims.iat) + ownerLifetime);
    if (role === 'owner' && now >= ownerUntil) return expired();
    if (renewed) {
      if (role === 'owner' && remembered.ownerProof) {
        await authorizeBookingOwnerSession(url, key, renewed, user.id, ownerUntil);
      }
      saveBrowserSession(res, renewed, remembered, now);
    }
    const assurance = claims.aal;
    if (role === 'owner' && assurance !== 'aal2') {
      const {data:googleVerified, error:sessionError} = await db.rpc('booking_has_google_session');
      if (sessionError) return send(503, {error:'Could not check your session. Try again.'});
      if (googleVerified !== true) {
        const email = user.email?.toLowerCase();
        const passwordOwner = email === process.env.BOOKING_OWNER_EMAIL?.trim().toLowerCase() &&
          user.app_metadata?.booking_password_setup === true;
        if (email === 'successpadelsamui@gmail.com' || passwordOwner) {
          clearBrowserSession(res);
          return send(401, {error:'Sign in again with your username and password.'});
        }
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
            const state = remembered ?? beginRemembered(session, role, false, now);
            saveBrowserSession(res, session, {...state, until:Math.min(state.until, ownerUntil)}, now);
            return send(200, {});
          } catch {
            return send(400, {error:'Authenticator code was rejected.'});
          }
        }
        return send(403, {mfa:true, factorId:factor?.id ?? null, error:'Authenticator verification required.'});
      }
    }

    if (role === 'owner') res.setHeader('X-Booking-Reauth-At', String(ownerUntil));
    if (action === 'session') return send(200, {role});

    if (action === 'staff-password' || action === 'staff-accounts') {
      if (role !== 'owner') return send(403, {error:'Admin access required.'});
      const response = await fetch(`${url}/functions/v1/booking-front-desk-password`, {
        method:'POST',
        headers:{apikey:key, Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
        body:JSON.stringify(action === 'staff-password' ? {password:body.password} : {action:body.operation, id:body.id, name:body.name, username:body.username, password:body.password}),
      });
      return send(response.status, await response.json());
    }

    if (action === 'calendar' || action === 'save-calendar') {
      const table = db.from('booking_calendar_records');
      if (action === 'calendar') {
        const {data,error} = await table.select('records,revision').eq('id',1).single();
        return error ? send(503,{error:'Calendar unavailable.'}) : send(200,data);
      }
      const {key,rows,revision} = body;
      if (!['success-padel-bookings','success-pilates-bookings','success-coach-availability','success-booking-packages-v1'].includes(key) ||
          !Array.isArray(rows) || !Number.isSafeInteger(revision) || revision < 0) return send(400,{error:'Invalid calendar change.'});
      const current = await table.select('records').eq('id',1).eq('revision',revision).maybeSingle();
      if (current.error) return send(503,{error:'Calendar unavailable.'});
      if (!current.data) return send(409,{error:'Calendar changed. Reload and try again.'});
      let output={...current.data.records,[key]:rows},changes=[];
      if(key==='success-padel-bookings'){
        try { ({output,changes}=applyLessonChanges(current.data.records,rows,Date.now(),body.cancellation)); }
        catch(err){ return send(400,{error:err.message}); }
      }
      let enabled=false;
      if(changes.some(c=>c.booking.customerId===lineTestMemberId)){
        const roster=await db.from('booking_member_roster').select('members').eq('id',1).single();
        if(roster.error)return send(503,{error:'Could not check notification preferences.'});
        enabled=bookingNotificationPreferences(roster.data.members).some(m=>m.id===lineTestMemberId && m.lineBookingNotificationsEnabled);
      }
      const {data,error} = await table.update({records:output,revision:revision+1})
        .eq('id',1).eq('revision',revision).select('revision').maybeSingle();
      if (error) return send(503,{error:'Could not save calendar.'});
      if(!data)return send(409,{error:'Calendar changed. Reload and try again.'});
      const notified=await sendLessonNotices(changes,enabled);
      return send(200,{...data,lessonCancellations:output.lessonCancellations,courtCancellations:output.courtCancellations,notificationWarning:!notified});
    }
    if (action === 'roster' && (req.query?.catalog === 'live' || req.query?.demo === 'samples')) {
      if (role !== 'owner') return send(403, {error:'Owner access required.'});
      const {data, error} = await db.from('booking_demo_samples').select('dataset').eq('id',1).single();
      if (error) return send(503, {error:'Could not load the catalog.'});
      if (req.query?.catalog === 'live') {
        const {bookings, products} = data.dataset;
        return send(200, {
          bookings:(bookings ?? []).filter(booking =>
            booking.eventType === 'competition' && booking.weeklyOngoing === true),
          products:products ?? [],
        });
      }
      return send(200, data.dataset);
    }

    if (action === 'roster' || action === 'workspace') {
      const rosterQuery = db.from('booking_member_roster').select('members,revision').eq('id',1).single();
      const calendarQuery = action === 'workspace'
        ? db.from('booking_calendar_records').select('records,revision').eq('id',1).single()
        : null;
      const [{data, error}, calendar] = await Promise.all([rosterQuery, calendarQuery]);
      if (error) return send(503, {error:'Could not load members.'});
      if (calendar?.error) return send(503, {error:'Calendar unavailable.'});
      const profileName = role === 'front_desk' ? 'SuccessPadel' :
        user.email?.toLowerCase() === process.env.BOOKING_KETT_EMAIL?.toLowerCase() ? 'Kett' : 'Peta';
      const avatar = user.user_metadata?.avatar_url;
      const profile = {
        name:profileName,
        avatar:role === 'owner' && typeof avatar === 'string' &&
          /^https:\/\/lh3\.googleusercontent\.com\//.test(avatar) ? avatar : null,
      };
      return send(200, {...data, members:bookingNotificationPreferences(data.members), role, profile, ...(calendar && {calendar:calendar.data})});
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
      const {data, error} = await db.from('booking_member_roster').update({members:bookingNotificationPreferences(members), revision:revision+1})
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
