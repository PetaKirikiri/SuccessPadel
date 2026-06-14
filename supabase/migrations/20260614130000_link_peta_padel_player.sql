-- Link Peta's roster padel_player to the email/LINE auth account; remove duplicate "C" row.

do $$
declare
  v_auth_id uuid := '7bdc33ac-7f21-4ebf-bfbf-343080724890';
  v_roster_id uuid := '57e78f89-005f-4518-b00d-65e525183d14';
  v_dup_id uuid := '7e41d99f-0baa-43f9-95bf-293a5fadcef1';
  v_line_user text := 'U2ead93df36642c95fda7cc039b71be60';
begin
  update public.session_players
  set profile_id = v_auth_id, padel_player_id = v_roster_id
  where padel_player_id in (v_roster_id, v_dup_id);

  delete from public.padel_players where id = v_dup_id;

  update public.padel_players
  set
    profile_id = v_auth_id,
    line_user_id = v_line_user,
    line_display_name = 'Peta Kirikiri',
    linked_at = coalesce(linked_at, now()),
    updated_at = now()
  where id = v_roster_id;
end $$;
