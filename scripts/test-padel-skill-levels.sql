-- Rollback-only integration checks against the applied level catalog migration.
begin;
set local statement_timeout='15s';
do $$
begin
 if (select array_agg(name order by rank) from public.padel_skill_levels)
    <> array['Beginner','Low Inter','Inter','High Inter','Advanced','Advanced Plus'] then
  raise exception 'Incorrect level catalog';
 end if;
 if (select count(*) from public.padel_skill_level_guides where locale='en' and status='draft') <> 6 then
  raise exception 'Expected six unpublished English guides';
 end if;
 if (select count(*) from pg_constraint where conname in ('profiles_skill_level_catalog_fk','padel_players_skill_level_catalog_fk') and contype='f' and convalidated)<>2 then
  raise exception 'Player level foreign keys missing';
 end if;
 begin
  update public.padel_skill_level_guides set status='published' where level_code='beginner' and locale='en';
  raise exception 'Incomplete guide was allowed to publish';
 exception when check_violation then null;
 end;
end $$;
create table public.skill_catalog_fk_probe(level text references public.padel_skill_levels(storage_value));
insert into skill_catalog_fk_probe select storage_value from public.padel_skill_levels;
do $$ begin
 begin
  insert into skill_catalog_fk_probe values('Open');
  raise exception 'Open was accepted as player ability';
 exception when foreign_key_violation then null;
 end;
end $$;
set local role anon;
do $$ begin
 if (select count(*) from public.padel_skill_levels) <> 6 then raise exception 'Public catalog unreadable'; end if;
 if (select count(*) from public.padel_skill_level_guides) <> 0 then raise exception 'Draft guide leaked'; end if;
 begin
  update public.padel_skill_levels set name='Changed' where code='beginner';
  raise exception 'Anonymous catalog write allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'PASS: six levels, player foreign keys, draft isolation, publication guard and public read-only permissions' as result;
