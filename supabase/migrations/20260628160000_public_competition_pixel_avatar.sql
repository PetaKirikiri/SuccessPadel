-- Include pixel_avatar on public competition roster + live round players (VS card fighters).

create or replace function public.get_public_competition(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when gs.game_kind <> 'competition' then null
    else jsonb_build_object(
      'session', to_jsonb(gs),
      'roster', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', sp.id,
          'profile_id', coalesce(sp.profile_id, pp.profile_id),
          'padel_player_id', sp.padel_player_id,
          'guest_name', sp.guest_name,
          'rank_order', sp.rank_order,
          'profiles', case
            when pr.id is not null then jsonb_build_object(
              'id', pr.id,
              'display_name', pr.display_name,
              'avatar_url', coalesce(pr.avatar_url, pp.line_picture_url),
              'pixel_avatar', pr.pixel_avatar
            )
            when pp.line_picture_url is not null or pp.line_display_name is not null then jsonb_build_object(
              'id', coalesce(pp.profile_id, pp.id),
              'display_name', coalesce(pp.line_display_name, sp.guest_name),
              'avatar_url', pp.line_picture_url
            )
            else null
          end
        ) order by sp.rank_order nulls last, sp.id), '[]'::jsonb)
        from public.session_players sp
        left join public.padel_players pp on pp.id = sp.padel_player_id
        left join public.profiles pr on pr.id = coalesce(sp.profile_id, pp.profile_id)
        where sp.session_id = gs.id
      ),
      'courts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'name', c.name, 'sort_order', c.sort_order
        ) order by c.sort_order), '[]'::jsonb)
        from public.courts c
        where c.is_active
      ),
      'rounds', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id,
          'session_id', r.session_id,
          'round_number', r.round_number,
          'is_final', r.is_final,
          'starts_at', r.starts_at,
          'ends_at', r.ends_at,
          'status', r.status,
          'competition_round_players', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'court_id', crp.court_id,
              'team', crp.team,
              'roster_entry_id', crp.roster_entry_id,
              'profile_id', coalesce(crp.profile_id, pp2.profile_id),
              'padel_player_id', sp.padel_player_id,
              'session_players', case when sp.id is null then null
                else jsonb_build_object(
                  'guest_name', sp.guest_name,
                  'profile_id', coalesce(sp.profile_id, pp2.profile_id),
                  'padel_player_id', sp.padel_player_id,
                  'profiles', case
                    when pr.id is not null then jsonb_build_object(
                      'id', pr.id,
                      'display_name', pr.display_name,
                      'avatar_url', coalesce(pr.avatar_url, pp2.line_picture_url),
                      'pixel_avatar', pr.pixel_avatar
                    )
                    when pp2.line_picture_url is not null or pp2.line_display_name is not null then jsonb_build_object(
                      'id', coalesce(pp2.profile_id, pp2.id),
                      'display_name', coalesce(pp2.line_display_name, sp.guest_name),
                      'avatar_url', pp2.line_picture_url
                    )
                    else null
                  end
                ) end,
              'courts', case when c.id is null then null
                else jsonb_build_object('id', c.id, 'name', c.name) end
            )), '[]'::jsonb)
            from public.competition_round_players crp
            left join public.session_players sp on sp.id = crp.roster_entry_id
            left join public.padel_players pp2 on pp2.id = sp.padel_player_id
            left join public.profiles pr on pr.id = coalesce(sp.profile_id, pp2.profile_id)
            left join public.courts c on c.id = crp.court_id
            where crp.round_id = r.id
          )
        ) order by r.round_number), '[]'::jsonb)
        from public.competition_rounds r
        where r.session_id = gs.id
      ),
      'matches', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'competition_round_id', m.competition_round_id,
          'court_id', m.court_id,
          'score_summary', m.score_summary,
          'played_at', m.played_at,
          'match_players', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'team', mp.team, 'is_winner', mp.is_winner,
              'padel_player_id', mp.padel_player_id
            )), '[]'::jsonb)
            from public.match_players mp
            where mp.match_id = m.id
          )
        )), '[]'::jsonb)
        from public.matches m
        where m.session_id = gs.id and m.competition_round_id is not null
      ),
      'leaderboard', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'profile_id', l.profile_id,
          'padel_player_id', l.padel_player_id,
          'member_profile_id', l.member_profile_id,
          'is_guest', l.is_guest,
          'display_name', l.display_name,
          'avatar_url', l.avatar_url,
          'total_points', l.total_points,
          'games', l.games,
          'wins', l.wins,
          'losses', l.losses,
          'draws', l.draws
        )), '[]'::jsonb)
        from public.get_competition_leaderboard(gs.id) l
      )
    )
  end
  from public.game_sessions gs
  where gs.id = p_session_id;
$$;

grant execute on function public.get_public_competition(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
