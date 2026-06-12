-- Include profile avatars in competition setup list (roster chips on hub cards).

create or replace function public.list_competitions_for_setup()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      to_jsonb(gs) || jsonb_build_object(
        'session_players',
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', sp.id,
            'profile_id', sp.profile_id,
            'guest_name', sp.guest_name,
            'guest_email', sp.guest_email,
            'rank_order', sp.rank_order,
            'profiles', case when pr.id is null then null
              else jsonb_build_object(
                'id', pr.id,
                'display_name', pr.display_name,
                'avatar_url', pr.avatar_url
              ) end
          ) order by sp.rank_order nulls last, sp.id), '[]'::jsonb)
          from public.session_players sp
          left join public.profiles pr on pr.id = sp.profile_id
          where sp.session_id = gs.id
        )
      )
      order by gs.starts_at nulls last, gs.starts_on nulls last
    ),
    '[]'::jsonb
  )
  from public.game_sessions gs
  where gs.game_kind = 'competition'
    and gs.status in ('open', 'locked', 'complete');
$$;
