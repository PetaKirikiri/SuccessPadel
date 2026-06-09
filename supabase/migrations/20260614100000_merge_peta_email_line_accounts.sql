-- Merge Peta's LINE auth user into the email/password account.
-- Survivor: peta@kapiki.co.nz (keeps email login + admin).
-- LINE login resolves the same profile via line_user_id.

do $$
declare
  v_email_id uuid := '7bdc33ac-7f21-4ebf-bfbf-343080724890';
  v_line_id uuid := 'f6bb7650-b9cb-48e2-8059-37e3b3ad269b';
  v_line_user text := 'U2ead93df36642c95fda7cc039b71be60';
  v_avatar text;
  v_name text;
begin
  select avatar_url, display_name into v_avatar, v_name
  from public.profiles where id = v_line_id;

  update public.padel_players set profile_id = v_email_id where profile_id = v_line_id;
  update public.game_sessions set created_by = v_email_id where created_by = v_line_id;
  update public.session_players set profile_id = v_email_id where profile_id = v_line_id;
  update public.match_players set profile_id = v_email_id where profile_id = v_line_id;
  update public.competition_round_players set profile_id = v_email_id where profile_id = v_line_id;
  update public.slot_players set profile_id = v_email_id where profile_id = v_line_id;
  update public.slot_court_assignments set profile_id = v_email_id where profile_id = v_line_id;
  update public.matches set created_by = v_email_id where created_by = v_line_id;
  update public.game_groups set created_by = v_email_id where created_by = v_line_id;
  update public.session_pairs set player_a_id = v_email_id where player_a_id = v_line_id;
  update public.session_pairs set player_b_id = v_email_id where player_b_id = v_line_id;

  update public.profiles set line_user_id = null where id = v_line_id;

  update public.profiles
  set
    display_name = coalesce(v_name, display_name),
    avatar_url = coalesce(v_avatar, avatar_url),
    line_user_id = v_line_user,
    is_admin = true
  where id = v_email_id;

  delete from public.profiles where id = v_line_id;
  delete from auth.users where id = v_line_id;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'line_user_id', v_line_user,
    'display_name', coalesce(v_name, raw_user_meta_data->>'display_name'),
    'avatar_url', v_avatar
  )
  where id = v_email_id;
end $$;
