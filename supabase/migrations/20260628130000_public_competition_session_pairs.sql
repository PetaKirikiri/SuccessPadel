-- Expose duo pair labels on the public play page (anon-safe).

create or replace function public.get_public_competition_session_pairs(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pair.id,
        'pair_label', pair.pair_label,
        'roster_a_id', pair.roster_a_id,
        'roster_b_id', pair.roster_b_id
      )
      order by pair.id
    ),
    '[]'::jsonb
  )
  from public.session_pairs pair
  join public.game_sessions gs on gs.id = pair.session_id
  where pair.session_id = p_session_id
    and gs.game_kind = 'competition';
$$;

grant execute on function public.get_public_competition_session_pairs(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
