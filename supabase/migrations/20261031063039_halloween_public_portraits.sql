-- Public presentation only. Descriptions and all mutation rights remain owner-only.
create or replace function public.list_halloween_portraits(p_session_ref text)
returns jsonb language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('roster_id',sp.id,'profile_id',s.profile_id,
   'player_id',s.player_id,'portrait_url',c.portrait_url,'revision',c.revision)), '[]'::jsonb)
 from public.game_sessions g
 join public.session_players sp on sp.session_id=g.id
 cross join lateral public.halloween_costume_subject(sp.id) s
 join public.player_event_costumes c on c.event_key='halloween-2026' and c.subject_key=s.subject_key
 where (g.id::text=p_session_ref or (length(p_session_ref)=8 and left(g.id::text,8)=p_session_ref))
 and g.title ~* '(halloween|ฮาโลวีน|🎃)'
 and c.portrait_url is not null and c.portrait_revision=c.revision and c.description<>'';
$$;
revoke all on function public.list_halloween_portraits(text) from public;
grant execute on function public.list_halloween_portraits(text) to anon,authenticated;
