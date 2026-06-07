-- Use only players÷4 courts for Americano (e.g. 12 players → courts 1–3, not court 4).

create or replace function public.assign_americano_round(p_round_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_round_number int;
  v_remaining uuid[];
  v_courts uuid[];
  v_courts_needed int;
  v_court_slot int := 0;
  v_court_id uuid;
  v_n int;
  v_best_score int;
  v_best_quad uuid[];
  v_team_a uuid[];
  v_team_b uuid[];
  v_split_score int;
  v_best_split_a uuid[];
  v_best_split_b uuid[];
  v_i int; v_j int; v_k int; v_l int;
  v_e1 uuid; v_e2 uuid; v_e3 uuid; v_e4 uuid;
begin
  delete from public.competition_round_players where round_id = p_round_id;

  select round_number into v_round_number
  from public.competition_rounds where id = p_round_id;

  select coalesce(array_agg(sp.id order by sp.id), '{}')
  into v_remaining
  from public.session_players sp
  where sp.session_id = p_session_id;

  select coalesce(array_agg(c.id order by c.sort_order), '{}')
  into v_courts
  from public.courts c
  where c.is_active;

  if coalesce(array_length(v_courts, 1), 0) = 0 then
    raise exception 'No active courts';
  end if;

  v_courts_needed := greatest(1, coalesce(array_length(v_remaining, 1), 0) / 4);
  if array_length(v_courts, 1) > v_courts_needed then
    v_courts := v_courts[1:v_courts_needed];
  end if;

  while coalesce(array_length(v_remaining, 1), 0) >= 4 loop
    v_n := array_length(v_remaining, 1);
    v_best_score := 2147483647;
    v_best_quad := null;

    for v_i in 1..(v_n - 3) loop
      for v_j in (v_i + 1)..(v_n - 2) loop
        for v_k in (v_j + 1)..(v_n - 1) loop
          for v_l in (v_k + 1)..v_n loop
            v_e1 := v_remaining[v_i];
            v_e2 := v_remaining[v_j];
            v_e3 := v_remaining[v_k];
            v_e4 := v_remaining[v_l];
            v_split_score := public._americano_quad_score(
              p_session_id, v_round_number, v_e1, v_e2, v_e3, v_e4
            );
            if v_split_score < v_best_score then
              v_best_score := v_split_score;
              v_best_quad := array[v_e1, v_e2, v_e3, v_e4];
            end if;
          end loop;
        end loop;
      end loop;
    end loop;

    if v_best_quad is null then
      exit;
    end if;

    v_e1 := v_best_quad[1];
    v_e2 := v_best_quad[2];
    v_e3 := v_best_quad[3];
    v_e4 := v_best_quad[4];

    v_best_score := 2147483647;
    v_best_split_a := null;
    v_best_split_b := null;

    v_split_score :=
      public._americano_partner_count(p_session_id, v_round_number, v_e1, v_e2)
      + public._americano_partner_count(p_session_id, v_round_number, v_e3, v_e4);
    if v_split_score < v_best_score then
      v_best_score := v_split_score;
      v_best_split_a := array[v_e1, v_e2];
      v_best_split_b := array[v_e3, v_e4];
    end if;

    v_split_score :=
      public._americano_partner_count(p_session_id, v_round_number, v_e1, v_e3)
      + public._americano_partner_count(p_session_id, v_round_number, v_e2, v_e4);
    if v_split_score < v_best_score then
      v_best_score := v_split_score;
      v_best_split_a := array[v_e1, v_e3];
      v_best_split_b := array[v_e2, v_e4];
    end if;

    v_split_score :=
      public._americano_partner_count(p_session_id, v_round_number, v_e1, v_e4)
      + public._americano_partner_count(p_session_id, v_round_number, v_e2, v_e3);
    if v_split_score < v_best_score then
      v_best_score := v_split_score;
      v_best_split_a := array[v_e1, v_e4];
      v_best_split_b := array[v_e2, v_e3];
    end if;

    v_court_slot := v_court_slot + 1;
    v_court_id := v_courts[((v_court_slot - 1 + v_round_number - 1) % array_length(v_courts, 1)) + 1];

    foreach v_e1 in array v_best_split_a loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'a'
      from public.session_players sp where sp.id = v_e1;
    end loop;

    foreach v_e1 in array v_best_split_b loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'b'
      from public.session_players sp where sp.id = v_e1;
    end loop;

    v_remaining := array(
      select x from unnest(v_remaining) as x
      where not (x = any(v_best_quad))
    );
  end loop;
end;
$body$;
