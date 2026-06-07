-- All games: strong+weak partners on each team (#1+#4 vs #2+#3 style), rotated per game.

create or replace function public.assign_ranked_americano_round(p_round_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_round_number int;
  v_ranked uuid[];
  v_courts uuid[];
  v_courts_needed int;
  v_court_slot int;
  v_court_id uuid;
  v_band_base int;
  v_band uuid[4];
  v_view uuid[4];
  v_offset int;
  v_split_idx int;
  v_split_a int[];
  v_split_b int[];
  v_j int;
  v_idx int;
begin
  delete from public.competition_round_players where round_id = p_round_id;

  select round_number into v_round_number
  from public.competition_rounds where id = p_round_id;

  select coalesce(array_agg(sp.id order by sp.rank_order, sp.id), '{}')
  into v_ranked
  from public.session_players sp
  where sp.session_id = p_session_id;

  if coalesce(array_length(v_ranked, 1), 0) < 4 then
    raise exception 'Need at least 4 players';
  end if;

  select coalesce(array_agg(c.id order by c.sort_order), '{}')
  into v_courts
  from public.courts c
  where c.is_active;

  v_courts_needed := greatest(1, coalesce(array_length(v_ranked, 1), 0) / 4);
  if array_length(v_courts, 1) > v_courts_needed then
    v_courts := v_courts[1:v_courts_needed];
  end if;

  case v_round_number
    when 1 then v_offset := 0; v_split_idx := 0;
    when 2 then v_offset := 0; v_split_idx := 1;
    when 3 then v_offset := 1; v_split_idx := 0;
    when 4 then v_offset := 1; v_split_idx := 1;
    when 5 then v_offset := 2; v_split_idx := 0;
    when 6 then v_offset := 2; v_split_idx := 1;
    when 7 then v_offset := 3; v_split_idx := 0;
    when 8 then v_offset := 3; v_split_idx := 1;
    else
      v_offset := (floor((v_round_number - 1)::numeric / 2)::int) % 4;
      v_split_idx := (v_round_number - 1) % 2;
  end case;

  if v_split_idx = 0 then
    v_split_a := array[1, 4];
    v_split_b := array[2, 3];
  else
    v_split_a := array[1, 3];
    v_split_b := array[2, 4];
  end if;

  for v_court_slot in 1..v_courts_needed loop
    v_band_base := (v_court_slot - 1) * 4;
    v_court_id := v_courts[v_court_slot];

    for v_j in 1..4 loop
      v_band[v_j] := v_ranked[v_band_base + v_j];
    end loop;

    for v_j in 1..4 loop
      v_view[v_j] := v_band[((v_j - 1 + v_offset) % 4) + 1];
    end loop;

    foreach v_idx in array v_split_a loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'a'
      from public.session_players sp where sp.id = v_view[v_idx];
    end loop;

    foreach v_idx in array v_split_b loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'b'
      from public.session_players sp where sp.id = v_view[v_idx];
    end loop;
  end loop;
end;
$body$;

notify pgrst, 'reload schema';
