create or replace function public.delete_friendly_session(p_id uuid)
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

  delete from public.friendly_sessions where id = p_id;

  if not found then
    raise exception 'Friendly game not found';
  end if;
end;
$body$;

grant execute on function public.delete_friendly_session(uuid) to authenticated;
