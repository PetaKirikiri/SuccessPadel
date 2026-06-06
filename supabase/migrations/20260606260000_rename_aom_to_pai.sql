-- Rename test player Aom → Pai (player15@fake.successpadel.test).

update public.profiles p
set display_name = 'Pai'
from auth.users u
where u.id = p.id
  and u.email = 'player15@fake.successpadel.test';

update auth.users u
set
  raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('display_name', 'Pai'),
  updated_at = now()
where u.email = 'player15@fake.successpadel.test';
