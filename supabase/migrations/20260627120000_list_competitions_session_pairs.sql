-- Include duo pair labels in competition setup list (invite cards).

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
            'padel_player_id', sp.padel_player_id,
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
