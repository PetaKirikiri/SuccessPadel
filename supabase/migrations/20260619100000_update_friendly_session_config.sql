create or replace function public.update_friendly_session_config(
  p_id uuid,
  p_organized_config jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.friendly_sessions
  set organized_config = p_organized_config
  where id = p_id;

  if not found then
    raise exception 'Friendly game not found';
  end if;
end;
$body$;

grant execute on function public.update_friendly_session_config(uuid, jsonb) to authenticated;
