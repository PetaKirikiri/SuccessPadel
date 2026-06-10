-- Court refs (member running live court scoring) + Natdanai admin.

alter table public.courts
  add column if not exists ref_profile_id uuid references public.profiles (id) on delete set null;

update public.courts
set ref_profile_id = '7bdc33ac-7f21-4ebf-bfbf-343080724890'
where name = 'Court 1';

update public.courts
set ref_profile_id = 'fcfa1008-aafc-4d64-9459-255205e371d1'
where name = 'Court 2';

update public.profiles
set is_admin = true
where id = 'fcfa1008-aafc-4d64-9459-255205e371d1';

create or replace function public.list_setup_courts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', c.name,
        'sort_order', c.sort_order,
        'ref',
          case
            when p.id is not null then jsonb_build_object(
              'profileId', p.id,
              'displayName', p.display_name,
              'avatarUrl', p.avatar_url
            )
            else null
          end
      )
      order by c.sort_order
    ),
    '[]'::jsonb
  )
  from public.courts c
  left join public.profiles p on p.id = c.ref_profile_id
  where c.is_active;
$$;
