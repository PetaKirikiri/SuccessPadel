begin;
lock table public.profiles,public.padel_players in share row exclusive mode;
create temporary table existing_court_members on commit drop as select id from public.owner_member_directory_data where court_member is true;
insert into public.member_directory_edit_log(member_id,patch,previous_values)
select id,'{"court_member":false,"reason":"owner_requested_default"}'::jsonb,'{"court_member":null}'::jsonb
from public.owner_member_directory_data where court_member is null;
alter table public.profiles alter column court_member set default false;
alter table public.padel_players alter column court_member set default false;
update public.profiles set court_member=false where court_member is null;
update public.padel_players set court_member=false where court_member is null;
do $$ begin
 if exists((select id from existing_court_members except select id from public.owner_member_directory_data where court_member is true)
 union all (select id from public.owner_member_directory_data where court_member is true except select id from existing_court_members)) then raise exception 'Existing membership changed'; end if;
 if exists(select 1 from public.owner_member_directory_data where court_member is null) then raise exception 'Unset membership remains'; end if;
end $$;
commit;
