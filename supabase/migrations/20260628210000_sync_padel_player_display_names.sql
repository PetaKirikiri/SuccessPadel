-- Align padel_players.display_name with linked profile when they diverge.
update public.padel_players pp
set display_name = p.display_name
from public.profiles p
where pp.profile_id = p.id
  and p.display_name is not null
  and btrim(p.display_name) <> ''
  and pp.display_name is distinct from p.display_name;
