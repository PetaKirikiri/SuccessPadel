-- Include completed friendly sessions on home (Past tab).

create or replace function public.list_friendly_home_sessions()
returns setof public.friendly_sessions
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.friendly_sessions
  where visibility = 'public'
     or created_by = (select auth.uid())
  order by created_at desc;
$$;
