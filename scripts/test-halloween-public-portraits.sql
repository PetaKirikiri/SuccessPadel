begin;
insert into public.player_event_costumes(event_key,subject_key,player_id,profile_id,session_player_id,display_name,description,revision,portrait_url,portrait_revision)
select 'halloween-2026',s.subject_key,s.player_id,s.profile_id,sp.id,s.display_name,'private test description',999,'https://example.invalid/portrait.png',999
from public.session_players sp cross join lateral public.halloween_costume_subject(sp.id) s
where sp.session_id='882f0946-4cf7-4575-b6b4-982146f02479' order by sp.rank_order limit 1
on conflict(event_key,subject_key) do update set description=excluded.description,revision=999,portrait_url=excluded.portrait_url,portrait_revision=999;
set local role anon;
do $$ declare rows jsonb; begin
 rows:=public.list_halloween_portraits('882f0946');
 assert jsonb_array_length(rows)>0;
 assert not exists(select 1 from jsonb_array_elements(rows) r where r ? 'description' or r ? 'subject_key');
 assert public.list_halloween_portraits('invalid')='[]'::jsonb;
 assert rows=public.list_halloween_portraits('882f0946-4cf7-4575-b6b4-982146f02479');
end $$;
reset role;
update public.player_event_costumes set revision=1000 where revision=999 and portrait_url='https://example.invalid/portrait.png';
set local role anon;
do $$ begin
 assert not exists(select 1 from jsonb_array_elements(public.list_halloween_portraits('882f0946')) r where r->>'portrait_url'='https://example.invalid/portrait.png');
end $$;
rollback;
