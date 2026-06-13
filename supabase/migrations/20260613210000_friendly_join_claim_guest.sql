-- Let LINE players claim a pre-named guest slot when names closely match (e.g. Ae / Aew).

create or replace function public.friendly_guest_name_matches(p_guest text, p_profile text)
returns boolean
language sql
immutable
as $$
  select case
    when coalesce(btrim(p_guest), '') = '' or coalesce(btrim(p_profile), '') = '' then false
    when lower(btrim(p_guest)) = lower(btrim(p_profile)) then true
    when length(btrim(p_profile)) >= 2
      and lower(btrim(p_guest)) like lower(btrim(p_profile)) || '%'
      and length(btrim(p_guest)) - length(btrim(p_profile)) <= 2 then true
    when length(btrim(p_guest)) >= 2
      and lower(btrim(p_profile)) like lower(btrim(p_guest)) || '%'
      and length(btrim(p_profile)) - length(btrim(p_guest)) <= 2 then true
    else false
  end;
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

  for v_i in 0..v_len - 1 loop
    if coalesce(v_ids ->> v_i, '') = ''
       and public.friendly_guest_name_matches(v_players ->> v_i, v_name) then
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

grant execute on function public.friendly_guest_name_matches(text, text) to authenticated;
grant execute on function public.join_friendly_session(uuid) to authenticated;
