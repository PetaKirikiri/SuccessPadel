-- Public friendly games board + join vacant slots.

create table public.friendly_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  visibility text not null check (visibility in ('public', 'private')),
  play_mode text not null check (play_mode in ('free', 'organized')),
  status text not null default 'ready' check (status in ('ready', 'complete')),
  players jsonb not null default '[]'::jsonb,
  profile_ids jsonb not null default '[]'::jsonb,
  profile_avatars jsonb not null default '[]'::jsonb,
  organized_config jsonb
);

create index friendly_sessions_public_board_idx
  on public.friendly_sessions (created_at desc)
  where visibility = 'public' and status = 'ready';

alter table public.friendly_sessions enable row level security;

create policy friendly_sessions_select on public.friendly_sessions
  for select to authenticated
  using (visibility = 'public' or created_by = (select auth.uid()));

create policy friendly_sessions_insert on public.friendly_sessions
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy friendly_sessions_update_own on public.friendly_sessions
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

grant select, insert, update on public.friendly_sessions to authenticated;

create or replace function public.upsert_friendly_session(
  p_title text,
  p_visibility text,
  p_play_mode text,
  p_players jsonb,
  p_profile_ids jsonb,
  p_profile_avatars jsonb,
  p_organized_config jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_visibility not in ('public', 'private') then
    raise exception 'Invalid visibility';
  end if;
  if p_play_mode not in ('free', 'organized') then
    raise exception 'Invalid play mode';
  end if;

  insert into public.friendly_sessions (
    created_by,
    title,
    visibility,
    play_mode,
    status,
    players,
    profile_ids,
    profile_avatars,
    organized_config
  )
  values (
    auth.uid(),
    coalesce(nullif(btrim(p_title), ''), 'Friendly match'),
    p_visibility,
    p_play_mode,
    'ready',
    coalesce(p_players, '[]'::jsonb),
    coalesce(p_profile_ids, '[]'::jsonb),
    coalesce(p_profile_avatars, '[]'::jsonb),
    p_organized_config
  )
  returning id into v_id;

  return v_id;
end;
$body$;

create or replace function public.list_public_friendly_sessions()
returns setof public.friendly_sessions
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.friendly_sessions
  where visibility = 'public'
    and status = 'ready'
  order by created_at desc;
$$;

create or replace function public.get_friendly_session(p_id uuid)
returns public.friendly_sessions
language sql
stable
security definer
set search_path = public
as $$
  select fs.*
  from public.friendly_sessions fs
  where fs.id = p_id
    and (
      fs.visibility = 'public'
      or fs.created_by = (select auth.uid())
    );
$$;

create or replace function public.join_friendly_session(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_row public.friendly_sessions%rowtype;
  v_players jsonb;
  v_ids jsonb;
  v_avatars jsonb;
  v_name text;
  v_avatar text;
  v_i int;
  v_len int;
  v_slot jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.friendly_sessions
  where id = p_id
  for update;

  if not found then
    raise exception 'Game not found';
  end if;
  if v_row.visibility <> 'public' or v_row.status <> 'ready' then
    raise exception 'Join not available';
  end if;

  v_players := coalesce(v_row.players, '[]'::jsonb);
  v_ids := coalesce(v_row.profile_ids, '[]'::jsonb);
  v_avatars := coalesce(v_row.profile_avatars, '[]'::jsonb);
  v_len := greatest(
    jsonb_array_length(v_players),
    jsonb_array_length(v_ids),
    jsonb_array_length(v_avatars),
    0
  );

  for v_i in 0..v_len - 1 loop
    if (v_ids ->> v_i) = auth.uid()::text then
      return;
    end if;
  end loop;

  select display_name, avatar_url into v_name, v_avatar
  from public.profiles
  where id = auth.uid();

  if v_name is null or btrim(v_name) = '' then
    raise exception 'Profile name required';
  end if;

  for v_i in 0..v_len - 1 loop
    if coalesce(btrim(v_players ->> v_i), '') = ''
       and coalesce(v_ids ->> v_i, '') = '' then
      v_players := jsonb_set(v_players, array[v_i::text], to_jsonb(v_name), true);
      v_ids := jsonb_set(v_ids, array[v_i::text], to_jsonb(auth.uid()::text), true);
      v_avatars := jsonb_set(
        v_avatars,
        array[v_i::text],
        coalesce(to_jsonb(v_avatar), 'null'::jsonb),
        true
      );

      update public.friendly_sessions
      set players = v_players,
          profile_ids = v_ids,
          profile_avatars = v_avatars
      where id = p_id;

      return;
    end if;
  end loop;

  raise exception 'No vacant spots';
end;
$body$;

grant execute on function public.upsert_friendly_session(text, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.list_public_friendly_sessions() to authenticated;
grant execute on function public.get_friendly_session(uuid) to authenticated;
grant execute on function public.join_friendly_session(uuid) to authenticated;
