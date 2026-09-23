import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { recogniseExistingLineMember } from '../_shared/lineRecognition.ts'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers })
  if (req.method !== 'POST') return new Response(null, { status: 405, headers })
  const guest = () => new Response(JSON.stringify({ recognised: false }), { headers })
  try {
    const channelId = Deno.env.get('LINE_CHANNEL_ID')
    if (!channelId) return guest()
    const { id_token, handoff } = await req.json()
    // Bound the entire server-side exchange, including database/auth requests.
    const signal = AbortSignal.timeout(10_000)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal }) },
      },
    )
    const result = await recogniseExistingLineMember(id_token, {
      verify: async (token) => {
        // LINE verifies signature, expiration and intended channel. Never trust
        // a client-supplied user id or fall back to an unverified JWT payload.
        const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ id_token: token, client_id: channelId }),
          signal,
        })
        if (!response.ok) return null
        const claims = await response.json()
        return typeof claims.sub === 'string' ? claims.sub : null
      },
      findProfile: async (lineId) => {
        const { data, error } = await admin.from('profiles')
          .select('id').ilike('line_user_id', lineId).maybeSingle()
        if (error) throw error // Ambiguous/failed lookup is never a new account.
        return data?.id ?? null
      },
      issueSession: async (profileId) => {
        const { data: account, error } = await admin.auth.admin.getUserById(profileId)
        if (error || !account.user?.email) return null
        const { data: link, error: linkError } = await admin.auth.admin.generateLink({
          type: 'magiclink', email: account.user.email,
        })
        if (linkError || !link.properties?.hashed_token) return null
        // Verify this one-use ticket on the canonical app origin, not the LIFF
        // endpoint (which may still be a legacy deployment host).
        if (handoff === true) return { ticket: link.properties.hashed_token }
        const { data, error: sessionError } = await admin.auth.verifyOtp({
          token_hash: link.properties.hashed_token, type: 'email',
        })
        if (sessionError || data.session?.user.id !== profileId) return null
        return {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }
      },
    })
    return new Response(JSON.stringify(result), { headers })
  } catch {
    // Do not expose identity details, tokens or provider errors to public visitors.
    return guest()
  }
})
