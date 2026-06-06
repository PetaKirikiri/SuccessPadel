-- Americano scoring_config: points, sets, or open (no fixed total).

create or replace function public.americano_scoring_unit(p_config jsonb)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_config->>'americano_unit', '') in ('points', 'sets', 'open')
      then p_config->>'americano_unit'
    when (p_config->>'americano_target')::int = 4 then 'sets'
    when p_config ? 'americano_target' then 'points'
    else 'points'
  end;
$$;

alter table public.game_sessions
  drop constraint if exists game_sessions_americano_scoring_check;

alter table public.game_sessions
  add constraint game_sessions_americano_scoring_check check (
    partnership_mode <> 'americano'
    or (
      public.americano_scoring_unit(scoring_config) in ('points', 'sets', 'open')
      and (
        public.americano_scoring_unit(scoring_config) = 'open'
        or coalesce((scoring_config->>'americano_target')::int, 0) >= 1
      )
    )
  );
