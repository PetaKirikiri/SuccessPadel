-- Only the server endpoint may execute this narrow, audited operation.
create table if not exists public.competition_signup_history (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.game_sessions(id),
  changed_at timestamptz not null default now(),
  before_roster jsonb not null,
  before_pairs jsonb not null,
  changes jsonb not null
);
alter table public.competition_signup_history enable row level security;
revoke all on public.competition_signup_history from anon, authenticated;
grant all on public.competition_signup_history to service_role;
grant usage on sequence public.competition_signup_history_id_seq to service_role;
create index if not exists competition_signup_history_session_time
  on public.competition_signup_history(session_id, changed_at desc);
-- Retain vacant slot identities so a cleared and refilled slot keeps its draw.
create table if not exists public.competition_signup_slots (
  session_id uuid not null references public.game_sessions(id),
  slot integer not null,
  roster_id uuid not null,
  pair_id uuid,
  pair_side text check(pair_side in ('a','b')),
  primary key(session_id,slot)
);
alter table public.competition_signup_slots enable row level security;
revoke all on public.competition_signup_slots from anon,authenticated;
grant all on public.competition_signup_slots to service_role;

create or replace function public.public_competition_signup(p_session_id uuid, p_changes jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  s public.game_sessions%rowtype;
  r public.session_players%rowtype;
  c jsonb;
  v_slot integer;
  name text;
  cap integer;
  pair_id uuid;
  new_id uuid;
  old_roster jsonb;
  old_pairs jsonb;
  side text;
begin
  select * into s from public.game_sessions where id=p_session_id for update;
  if not found or s.game_kind <> 'competition' or s.status <> 'open'
    or s.competition_started_at is not null or s.starts_on < (now() at time zone 'Asia/Bangkok')::date
    or exists(select 1 from public.competition_rounds where session_id=p_session_id)
    or exists(select 1 from public.matches where session_id=p_session_id) then
    raise exception 'Registration is closed';
  end if;
  cap := coalesce(s.max_players,s.target_players,0);
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) not between 1 and 64 then
    raise exception 'Invalid changes';
  end if;
  if (select count(*) from public.competition_signup_history
      where session_id=p_session_id and changed_at>now()-interval '1 minute') >= 60 then
    raise exception 'Too many edits. Please wait a minute';
  end if;
  select coalesce(jsonb_agg(to_jsonb(p)),'[]') into old_roster from public.session_players p where session_id=p_session_id;
  select coalesce(jsonb_agg(to_jsonb(p)),'[]') into old_pairs from public.session_pairs p where session_id=p_session_id;
  for c in select value from jsonb_array_elements(p_changes) loop
    v_slot := (c->>'slot')::integer;
    name := btrim(coalesce(c->>'name',''));
    if v_slot is null or v_slot < 0 or v_slot >= cap or length(name)>80 or name ~ '[[:cntrl:]]' then
      raise exception 'Invalid name or slot';
    end if;
    select * into r from public.session_players where session_id=p_session_id and rank_order=v_slot;
    if coalesce(r.id::text,'') <> coalesce(c->>'expected_id','')
      or coalesce(r.profile_id::text,'') <> coalesce(c->>'expected_profile_id','')
      or coalesce(r.padel_player_id::text,'') <> coalesce(c->>'expected_padel_player_id','')
      or coalesce(r.guest_name,'') <> coalesce(c->>'expected_guest_name','') then
      raise exception 'This slot changed. Refresh before editing it again';
    end if;
    select p.id,case when p.roster_a_id=r.id then 'a' else 'b' end into pair_id,side
      from public.session_pairs p where p.session_id=p_session_id and r.id in(p.roster_a_id,p.roster_b_id);
    if r.id is not null then
      insert into public.competition_signup_slots(session_id,slot,roster_id,pair_id,pair_side)
        values(p_session_id,v_slot,r.id,pair_id,side)
        on conflict(session_id,slot) do update set roster_id=excluded.roster_id,pair_id=excluded.pair_id,pair_side=excluded.pair_side;
    else
      select m.roster_id,m.pair_id,m.pair_side into new_id,pair_id,side
        from public.competition_signup_slots m where m.session_id=p_session_id and m.slot=v_slot;
    end if;
    if name='' then
      update public.session_pairs set player_a_id=null,roster_a_id=null where session_id=p_session_id and roster_a_id=r.id;
      update public.session_pairs set player_b_id=null,roster_b_id=null where session_id=p_session_id and roster_b_id=r.id;
      delete from public.session_players where session_id=p_session_id and id=r.id;
    else
      if r.id is not null then
        update public.session_players set guest_name=name,guest_email=null,profile_id=null,padel_player_id=null where id=r.id;
        new_id:=r.id;
      else
        insert into public.session_players(id,session_id,rank_order,guest_name)
          values(coalesce(new_id,gen_random_uuid()),p_session_id,v_slot,name) returning id into new_id;
      end if;
      -- Pair records remain authoritative; never recreate an existing pair.
      update public.session_pairs set player_a_id=null where session_id=p_session_id and roster_a_id=new_id;
      update public.session_pairs set player_b_id=null where session_id=p_session_id and roster_b_id=new_id;
      if pair_id is null and s.scoring_config->>'competition_player_mode'='duos' then
        side:=case when v_slot%2=0 then 'a' else 'b' end;
        select p.id into pair_id from public.session_pairs p
          left join public.session_players a on a.id=p.roster_a_id
          left join public.session_players b on b.id=p.roster_b_id
          where p.session_id=p_session_id and (a.rank_order/2=v_slot/2 or b.rank_order/2=v_slot/2 or p.pair_label='Team '||(v_slot/2+1)::text)
          limit 1;
        if pair_id is null then
          insert into public.session_pairs(session_id,pair_label) values(p_session_id,'Team '||(v_slot/2+1)::text) returning id into pair_id;
        end if;
      end if;
      if pair_id is not null then
        if side='a' then
          update public.session_pairs set roster_a_id=new_id,player_a_id=null where id=pair_id and (roster_a_id is null or roster_a_id=new_id);
        else
          update public.session_pairs set roster_b_id=new_id,player_b_id=null where id=pair_id and (roster_b_id is null or roster_b_id=new_id);
        end if;
      end if;
    end if;
  end loop;
  insert into public.competition_signup_history(session_id,before_roster,before_pairs,changes)
    values(p_session_id,old_roster,old_pairs,p_changes);
end $$;
revoke all on function public.public_competition_signup(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.public_competition_signup(uuid,jsonb) to service_role;
