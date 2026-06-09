-- Restore and self-heal club-owner admin for Peta.

update public.profiles
set is_admin = true
where id = '7bdc33ac-7f21-4ebf-bfbf-343080724890'
   or line_user_id = 'U2ead93df36642c95fda7cc039b71be60';

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users%rowtype;
  v_profile public.profiles%rowtype;
  v_line_id text;
  v_is_admin boolean;
  v_owner_line_id constant text := 'U2ead93df36642c95fda7cc039b71be60';
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if found then
    if (v_profile.line_user_id = v_owner_line_id or v_profile.id = '7bdc33ac-7f21-4ebf-bfbf-343080724890')
       and not v_profile.is_admin then
      update public.profiles
      set is_admin = true
      where id = v_profile.id
      returning * into v_profile;
    end if;
    return v_profile;
  end if;

  select * into v_user from auth.users where id = auth.uid();
  v_line_id := v_user.raw_user_meta_data ->> 'line_user_id';
  v_is_admin := not exists (select 1 from public.profiles);
  if v_line_id = v_owner_line_id or auth.uid() = '7bdc33ac-7f21-4ebf-bfbf-343080724890' then
    v_is_admin := true;
  end if;

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
    v_line_id,
    v_is_admin
  )
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;
