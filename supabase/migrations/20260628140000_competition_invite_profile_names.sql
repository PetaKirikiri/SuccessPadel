-- Invite cards: show current profile / padel player names, not stale guest_name snapshots.

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
            'profiles', case
              when coalesce(pr.id, pr_pp.id) is not null then jsonb_build_object(
                'id', coalesce(pr.id, pr_pp.id),
                'display_name', coalesce(
                  nullif(btrim(pr.display_name), ''),
                  nullif(btrim(pr_pp.display_name), '')
                ),
                'avatar_url', coalesce(pr.avatar_url, pr_pp.avatar_url)
              )
              when pp.id is not null then jsonb_build_object(
                'id', pp.profile_id,
                'display_name', coalesce(
                  nullif(btrim(pp.display_name), ''),
                  nullif(btrim(sp.guest_name), '')
                ),
                'avatar_url', null
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
