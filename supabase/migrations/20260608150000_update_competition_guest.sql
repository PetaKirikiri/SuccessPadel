create or replace function public.update_competition_guest(
  p_roster_id uuid,
  p_display_name text,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_row public.session_players%rowtype;
  v_name text;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  v_name := btrim(p_display_name);
  if v_name = '' then
    raise exception 'Name required';
  end if;

  v_email := nullif(lower(btrim(p_email)), '');

  select sp.* into v_row
  from public.session_players sp
  where sp.id = p_roster_id;

  if not found or v_row.guest_name is null then
    raise exception 'Guest not found';
  end if;

  if exists (
    select 1 from public.game_sessions gs
    where gs.id = v_row.session_id
      and (gs.status <> 'open' or gs.competition_started_at is not null)
  ) then
    raise exception 'Sign-ups are closed';
  end if;

  update public.session_players
  set guest_name = v_name,
      guest_email = v_email
  where id = p_roster_id;
end;
$body$;

grant execute on function public.update_competition_guest(uuid, text, text) to authenticated;
