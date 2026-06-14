-- Remove duplicate LINE ghost account created by case-sensitive line_user_id lookup.
-- Survivor: Peta Kirikiri (7bdc33ac) with line_user_id U2ead93df36642c95fda7cc039b71be60.

do $$
declare
  v_ghost_id uuid := 'd19bccb3-c435-4654-9641-d7a2349f3cde';
begin
  update public.padel_players set profile_id = null where profile_id = v_ghost_id;
  update public.game_sessions set created_by = null where created_by = v_ghost_id;
  update public.session_players set profile_id = null where profile_id = v_ghost_id;
  update public.match_players set profile_id = null where profile_id = v_ghost_id;
  update public.competition_round_players set profile_id = null where profile_id = v_ghost_id;
  update public.slot_players set profile_id = null where profile_id = v_ghost_id;
  update public.slot_court_assignments set profile_id = null where profile_id = v_ghost_id;
  update public.matches set created_by = null where created_by = v_ghost_id;
  update public.game_groups set created_by = null where created_by = v_ghost_id;
  update public.session_pairs set player_a_id = null where player_a_id = v_ghost_id;
  update public.session_pairs set player_b_id = null where player_b_id = v_ghost_id;

  delete from public.profiles where id = v_ghost_id;
  delete from auth.users where id = v_ghost_id;
end $$;
