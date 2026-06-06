# SuccessPadel

Weekly padel club competition tracker — standings, admin game settings, LINE Login / LIFF.

## Setup

1. Create a [Supabase](https://supabase.com) project.
2. Apply migration: `supabase/migrations/20260303120000_initial_schema.sql` (Dashboard SQL or `supabase db push`).
3. Copy `.env.example` → `.env.local` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Optional LINE: set `VITE_LIFF_ID`, configure Supabase Auth custom OIDC provider `custom:line`, deploy Edge Functions.
5. `npm install && npm run dev`

## Admin bootstrap

After first signup, promote your user:

```sql
update public.profiles set is_admin = true where id = '<your-auth-user-uuid>';
```

## Deploy (Vercel)

- Root: `SuccessPadel`
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LIFF_ID`
- Supabase Auth redirect URLs: `https://<your-domain>/auth/callback`
- LINE LIFF endpoint: same production URL

## Edge Functions

```bash
supabase functions deploy line-liff-auth --no-verify-jwt
supabase functions deploy parse-match
supabase functions deploy weekly-summary
```

Secrets: `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (for `line-liff-auth`).
