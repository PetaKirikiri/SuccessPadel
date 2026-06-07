-- Global cross-half schedule: rank 1+16, 2+15, … with rotated partners each game.

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
  v_half int;
  v_match_count int;
  v_g int;
  v_i int;
  v_m int;
  v_top_idx int;
  v_bottom_idx int;
  v_court_id uuid;
  v_pair_a_top uuid;
  v_pair_a_bottom uuid;
  v_pair_b_top uuid;
  v_pair_b_bottom uuid;
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

  v_half := array_length(v_ranked, 1) / 2;
  v_match_count := v_half / 2;
  v_g := case when v_half <= 2 then 0 else v_round_number - 1 end;

  select coalesce(array_agg(c.id order by c.sort_order), '{}')
  into v_courts
  from public.courts c
  where c.is_active;

  if array_length(v_courts, 1) > v_match_count then
    v_courts := v_courts[1:v_match_count];
  end if;

  for v_m in 0..(v_match_count - 1) loop
    v_court_id := v_courts[v_m + 1];

    v_i := v_m * 2;
    v_top_idx := v_i + 1;
    v_bottom_idx := v_half + (((v_half - 1 - v_i + v_g) % v_half) + v_half) % v_half + 1;
    v_pair_a_top := v_ranked[v_top_idx];
    v_pair_a_bottom := v_ranked[v_bottom_idx];

    v_i := v_m * 2 + 1;
    v_top_idx := v_i + 1;
    v_bottom_idx := v_half + (((v_half - 1 - v_i + v_g) % v_half) + v_half) % v_half + 1;
    v_pair_b_top := v_ranked[v_top_idx];
    v_pair_b_bottom := v_ranked[v_bottom_idx];

    insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
    select p_round_id, v_court_id, sp.id, sp.profile_id, 'a'
    from public.session_players sp where sp.id in (v_pair_a_top, v_pair_a_bottom);

    insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
    select p_round_id, v_court_id, sp.id, sp.profile_id, 'b'
    from public.session_players sp where sp.id in (v_pair_b_top, v_pair_b_bottom);
  end loop;
end;
$body$;

notify pgrst, 'reload schema';
