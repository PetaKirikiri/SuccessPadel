-- Guest name self-join disabled; players link LINE from the leaderboard instead.

create or replace function public.self_join_competition_guest(
  p_session_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
begin
  raise exception 'Guest sign-up is disabled';
end;
$body$;
