-- One event-specific costume record per player identity, not their editable name/slot.
create table public.player_event_costumes (
  event_key text not null,
  subject_key text not null,
  player_id uuid references public.padel_players(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  session_player_id uuid references public.session_players(id) on delete set null,
  display_name text not null,
  description text not null default '' check (char_length(description) <= 2000),
  revision integer not null default 1,
  portrait_url text,
  portrait_revision integer,
  updated_at timestamptz not null default now(),
  primary key (event_key, subject_key)
);
alter table public.player_event_costumes enable row level security;
revoke all on public.player_event_costumes from anon, authenticated;

-- Identity is resolved on the server. Existing account links take precedence over guests.
create function public.halloween_costume_subject(p_roster_id uuid)
returns table(subject_key text, player_id uuid, profile_id uuid, display_name text)
language sql stable security invoker set search_path = '' as $$
 select case when coalesce(sp.padel_player_id,pp.id) is not null then 'player:'||coalesce(sp.padel_player_id,pp.id)::text
   when sp.profile_id is not null then 'profile:'||sp.profile_id::text
   else 'guest:'||sp.id::text||':'||md5(coalesce(sp.guest_name,'')) end,
   coalesce(sp.padel_player_id,pp.id),sp.profile_id,
   coalesce(nullif(sp.guest_name,''),nullif(p.display_name,''),nullif(pp.display_name,''),'Player')
 from public.session_players sp
 left join public.profiles p on p.id=sp.profile_id
 left join lateral (select id,display_name from public.padel_players where id=sp.padel_player_id or (sp.padel_player_id is null and profile_id=sp.profile_id) order by id limit 1) pp on true
 where sp.id=p_roster_id;
$$;
revoke all on function public.halloween_costume_subject(uuid) from public,anon,authenticated;

create function public.list_halloween_costumes(p_session_id uuid,p_access_token text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if public.can_edit_member_directory(p_access_token) is not true then raise exception 'Owner access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
   'roster_id',sp.id,'subject_key',s.subject_key,'player_id',s.player_id,'profile_id',s.profile_id,
   'display_name',s.display_name,'description',coalesce(c.description,''),'revision',coalesce(c.revision,0),
   'portrait_url',c.portrait_url,'updated_at',c.updated_at,
   'needs_avatar',coalesce(c.description<>'',false) and (c.portrait_url is null or c.portrait_revision is distinct from c.revision)
 ) order by sp.rank_order)
 from public.session_players sp cross join lateral public.halloween_costume_subject(sp.id) s
 left join public.player_event_costumes c on c.event_key='halloween-2026' and c.subject_key=s.subject_key
 where sp.session_id=p_session_id),'[]'::jsonb);
end $$;

create function public.save_halloween_costume(p_session_id uuid,p_roster_id uuid,p_subject_key text,p_description text,p_expected_revision integer,p_access_token text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s record; c public.player_event_costumes; v_description text:=btrim(coalesce(p_description,''));
begin
 if public.can_edit_member_directory(p_access_token) is not true then raise exception 'Owner access required' using errcode='42501'; end if;
 if char_length(v_description)>2000 then raise exception 'Costume description is too long'; end if;
 if not exists(select 1 from public.game_sessions where id=p_session_id and lower(title) like '%halloween%') then raise exception 'Not a Halloween event'; end if;
 perform 1 from public.session_players where id=p_roster_id and session_id=p_session_id for update;
 if not found then raise exception 'Player is no longer in this event'; end if;
 select * into s from public.halloween_costume_subject(p_roster_id);
 if s.subject_key is distinct from p_subject_key then raise exception 'This player changed. Reload before saving their costume.' using errcode='40001'; end if;
 if s.display_name ~* '^(Open place [0-9]+|Player)?$' then raise exception 'Add a player name first'; end if;
 perform pg_advisory_xact_lock(hashtextextended('halloween-2026:'||s.subject_key,0));
 select * into c from public.player_event_costumes where event_key='halloween-2026' and subject_key=s.subject_key for update;
 if coalesce(c.revision,0)<>p_expected_revision then raise exception 'Costume changed elsewhere. Reload before saving.' using errcode='40001'; end if;
 if c.description is not distinct from v_description then return to_jsonb(c); end if;
 insert into public.player_event_costumes(event_key,subject_key,player_id,profile_id,session_player_id,display_name,description,revision)
 values('halloween-2026',s.subject_key,s.player_id,s.profile_id,p_roster_id,s.display_name,v_description,1)
 on conflict(event_key,subject_key) do update set description=excluded.description,display_name=excluded.display_name,
   session_player_id=excluded.session_player_id,player_id=excluded.player_id,profile_id=excluded.profile_id,
   revision=player_event_costumes.revision+1,updated_at=now()
 returning * into c;
 return to_jsonb(c);
end $$;
revoke all on function public.list_halloween_costumes(uuid,text) from public;
revoke all on function public.save_halloween_costume(uuid,uuid,text,text,integer,text) from public;
grant execute on function public.list_halloween_costumes(uuid,text) to anon,authenticated;
grant execute on function public.save_halloween_costume(uuid,uuid,text,text,integer,text) to anon,authenticated;
