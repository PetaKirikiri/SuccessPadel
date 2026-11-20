create table if not exists public.scorer_input_diagnostics (
  session_id uuid primary key,
  created_at timestamptz not null default now(),
  browser text not null check (char_length(browser) <= 200),
  events jsonb not null check (jsonb_typeof(events) = 'array' and octet_length(events::text) <= 8192)
);
alter table public.scorer_input_diagnostics enable row level security;
revoke all on public.scorer_input_diagnostics from anon, authenticated;
grant insert (session_id, browser, events) on public.scorer_input_diagnostics to anon, authenticated;
create policy "Write scorer diagnostic" on public.scorer_input_diagnostics
  for insert to anon, authenticated with check (true);
