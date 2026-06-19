-- Keep duo team slots fixed when rosters are sparse (e.g. name in team 1 and team 3 only).

create or replace function public.sync_competition_pairs(
  p_session_id uuid,
  p_pairs jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_pair jsonb;
  v_label text;
  v_roster_a uuid;
  v_roster_b uuid;
  v_profile_a uuid;
  v_profile_b uuid;
  v_i int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;

  delete from public.session_pairs where session_id = p_session_id;

  if p_pairs is null or jsonb_typeof(p_pairs) <> 'array' then
    return;
  end if;

  for v_i in 0..jsonb_array_length(p_pairs) - 1 loop
    v_pair := p_pairs->v_i;
    v_label := nullif(btrim(coalesce(v_pair->>'label', '')), '');
    v_roster_a := nullif(v_pair->>'roster_a_id', '')::uuid;
    v_roster_b := nullif(v_pair->>'roster_b_id', '')::uuid;

    if v_roster_a is null and v_pair ? 'slot_a' then
      select sp.id into v_roster_a
      from public.session_players sp
      where sp.session_id = p_session_id
        and sp.rank_order = (v_pair->>'slot_a')::int;
    end if;

    if v_roster_b is null and v_pair ? 'slot_b' then
      select sp.id into v_roster_b
      from public.session_players sp
      where sp.session_id = p_session_id
        and sp.rank_order = (v_pair->>'slot_b')::int;
    end if;

    if v_roster_a is null and v_roster_b is null then
      continue;
    end if;

    select sp.profile_id into v_profile_a
    from public.session_players sp
    where sp.id = v_roster_a and sp.session_id = p_session_id;

    select sp.profile_id into v_profile_b
    from public.session_players sp
    where sp.id = v_roster_b and sp.session_id = p_session_id;

    insert into public.session_pairs (
      session_id,
      pair_label,
      player_a_id,
      player_b_id,
      roster_a_id,
      roster_b_id
    ) values (
      p_session_id,
      v_label,
      v_profile_a,
      v_profile_b,
      v_roster_a,
      v_roster_b
    );
  end loop;
end;
$body$;

notify pgrst, 'reload schema';
