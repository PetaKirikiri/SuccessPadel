-- Keep the public competition read contract explicit and omit private guest contact details.

create or replace function public.list_competitions_for_setup()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', gs.id,
        'season_id', gs.season_id,
        'title', gs.title,
        'week_number', gs.week_number,
        'starts_on', gs.starts_on,
        'ends_on', gs.ends_on,
        'status', gs.status,
        'partnership_mode', gs.partnership_mode,
        'scoring_preset', gs.scoring_preset,
        'scoring_config', gs.scoring_config,
        'schedule_game_count', gs.schedule_game_count,
        'schedule_game_minutes', gs.schedule_game_minutes,
        'schedule_break_minutes', gs.schedule_break_minutes,
        'who_can_log_matches', gs.who_can_log_matches,
        'margin_bonus_enabled', gs.margin_bonus_enabled,
        'max_players', gs.max_players,
        'created_by', gs.created_by,
        'court_id', gs.court_id,
        'starts_at', gs.starts_at,
        'ends_at', gs.ends_at,
        'visibility', gs.visibility,
        'game_kind', gs.game_kind,
        'target_players', gs.target_players,
        'player_cap_mode', gs.player_cap_mode,
        'game_group_id', gs.game_group_id,
        'skill_level_min_rank', gs.skill_level_min_rank,
        'skill_level_max_rank', gs.skill_level_max_rank,
        'skill_level', gs.skill_level,
        'gender', gs.gender,
        'rules', gs.rules,
        'competition_started_at', gs.competition_started_at,
        'competition_ended_at', gs.competition_ended_at,
        'competition_concluded_at', to_jsonb(gs)->'competition_concluded_at',
        'session_players',
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', sp.id,
            'profile_id', sp.profile_id,
            'padel_player_id', sp.padel_player_id,
            'guest_name', sp.guest_name,
            'rank_order', sp.rank_order,
            'profiles', case
              when coalesce(pr.id, pr_pp.id) is not null then jsonb_build_object(
                'id', coalesce(pr.id, pr_pp.id),
                'display_name', coalesce(
                  nullif(btrim(pr.display_name), ''),
                  nullif(btrim(pr_pp.display_name), '')
                ),
                'avatar_url', coalesce(pr.avatar_url, pr_pp.avatar_url, pp.line_picture_url),
                'pixel_avatar', coalesce(pr.pixel_avatar, pr_pp.pixel_avatar),
                'pixel_avatar_url', coalesce(pr.pixel_avatar_url, pr_pp.pixel_avatar_url)
              )
              when pp.id is not null then jsonb_build_object(
                'id', coalesce(pp.profile_id, pp.id),
                'display_name', coalesce(
                  nullif(btrim(pp.display_name), ''),
                  nullif(btrim(sp.guest_name), '')
                ),
                'avatar_url', pp.line_picture_url
              )
              when nullif(btrim(sp.guest_name), '') is not null then jsonb_build_object(
                'id', sp.profile_id,
                'display_name', sp.guest_name,
                'avatar_url', null
              )
              else null
            end
          ) order by sp.rank_order nulls last, sp.id), '[]'::jsonb)
          from public.session_players sp
          left join public.profiles pr on pr.id = sp.profile_id
          left join public.padel_players pp on pp.id = sp.padel_player_id
          left join public.profiles pr_pp on pr_pp.id = pp.profile_id
          where sp.session_id = gs.id
        ),
        'session_pairs',
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', pair.id,
            'pair_label', pair.pair_label,
            'roster_a_id', pair.roster_a_id,
            'roster_b_id', pair.roster_b_id
          ) order by pair.id), '[]'::jsonb)
          from public.session_pairs pair
          where pair.session_id = gs.id
        )
      )
      order by gs.starts_at nulls last, gs.starts_on nulls last
    ),
    '[]'::jsonb
  )
  from public.game_sessions gs
  where gs.game_kind = 'competition'
    and (
      gs.status in ('open', 'locked', 'complete')
      or (gs.status = 'draft' and gs.game_group_id is not null)
    );
$$;

notify pgrst, 'reload schema';
