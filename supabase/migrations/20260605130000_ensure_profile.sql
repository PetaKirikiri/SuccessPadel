-- Ensure every authenticated user has a profiles row (fallback if trigger missed).
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if found then
    return v_profile;
  end if;

  select * into v_user from auth.users where id = auth.uid();

  insert into public.profiles (id, display_name, avatar_url, line_user_id, is_admin)
  values (
    v_user.id,
    coalesce(
      v_user.raw_user_meta_data ->> 'display_name',
      v_user.raw_user_meta_data ->> 'name',
      split_part(v_user.email, '@', 1),
      'Player'
    ),
    coalesce(v_user.raw_user_meta_data ->> 'avatar_url', v_user.raw_user_meta_data ->> 'picture'),
    v_user.raw_user_meta_data ->> 'line_user_id',
    not exists (select 1 from public.profiles)
  )
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;
