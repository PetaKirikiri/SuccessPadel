import {createHmac} from 'node:crypto';

const sign = (key,text) => createHmac('sha256',key).update(text).digest('hex');
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).end();
  const reserve = req.method==='POST';
  if (reserve && (!req.headers['content-type']?.startsWith('application/json') ||
    (req.headers.origin && new URL(req.headers.origin).host!==req.headers.host))) return res.status(403).end();
  const input = (reserve ? req.body : req.query) ?? {};
  const {date,activity} = input;
  if (!['padel','pilates'].includes(activity) || typeof date!=='string' || !/^\d{4}-\d\d-\d\d$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date)
    return res.status(400).json({error:'Choose a valid date.'});
  const key = process.env.BOOKING_GOOGLE_SESSION_KEY;
  if (!key) return res.status(503).json({error:'Booking is temporarily unavailable.'});
  const data = {action:reserve?'reserve':'slots',activity,date,issued:Math.floor(Date.now()/1000)};
  if (reserve) {
    const {resource,minute,kind,coach,id} = input;
    const name = typeof input.name==='string' ? input.name.trim() : '';
    if (!name || name.length>80 || /[<>&"\u0000-\u001f\u007f]/u.test(name))
      return res.status(400).json({error:'Enter a name using letters, spaces or name punctuation.'});
    if (!Number.isInteger(resource) || resource<1 || resource>4 || !Number.isInteger(minute) ||
       minute<420 || minute>=1320 || minute%30 || !['play','coaching','group','private','duo'].includes(kind) ||
       !(coach===null || (typeof coach==='string' && coach.length<=60)) ||
       typeof id!=='string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))
      return res.status(400).json({error:'Choose an available time.'});
    const ip = req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress;
    Object.assign(data,{name,resource,minute,kind,coach,id,requester:sign(key,'guest-address:'+ip)});
  }
  try {
    const payload = JSON.stringify(data);
    const response = await fetch(process.env.BOOKING_SUPABASE_URL+'/rest/v1/rpc/booking_guest_calendar',{
      method:'POST',headers:{apikey:process.env.BOOKING_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({payload,signature:sign(key,'booking-guest-v1:'+payload)}),signal:AbortSignal.timeout(12000)
    });
    if (response.status===409) return res.status(409).json({error:'This time has just been booked. Choose another slot.'});
    if (response.status===429) return res.status(429).json({error:'Too many bookings. Try again in ten minutes.'});
    if (!response.ok) throw new Error();
    const result = await response.json();
    return reserve ? res.status(201).json({reference:result.reference}) :
      res.status(200).json(result.map(({resource,minute,duration,kind,coach})=>({resource,minute,duration,kind,coach})));
  } catch {
    return res.status(503).json({error:'Could not reach the calendar. Try again.'});
  }
}
