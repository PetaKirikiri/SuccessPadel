-- Bia (LINE: เบียสิงท์) — short Latin display name for court cards / rosters.

update public.profiles
set display_name = 'Bia'
where id = 'f5384b42-d681-4b49-90aa-926d6f34e1f4';

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', 'Bia')
where id = 'f5384b42-d681-4b49-90aa-926d6f34e1f4';

update public.friendly_sessions
set players = (
  select coalesce(
    jsonb_agg(to_jsonb(case when value = 'เบียสิงท์' then 'Bia' else value end)),
    '[]'::jsonb
  )
  from jsonb_array_elements_text(players) as value
)
where players::text like '%เบีย%';
