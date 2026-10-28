-- Extend the existing ledger without rewriting historical assignments or scores.
alter table public.rain_mode_scores drop constraint rain_mode_scores_game_number_check;
alter table public.rain_mode_scores add constraint rain_mode_scores_game_number_check check (game_number between 1 and 20);

create or replace function public.update_rain_mode_timing(
  p_session_id uuid, p_fingerprint text, p_start text,
  p_game_minutes integer, p_break_minutes integer
) returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.rain_mode_draws;
  start_min integer;
  cutoff_min integer;
  count_rounds integer;
  updated_rounds jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin only'; end if;
  if p_start is null or p_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or p_game_minutes is null or p_game_minutes not between 5 and 60
    or p_break_minutes is null or p_break_minutes not between 1 and 30 then
    raise exception 'Enter a valid start time, 5–60 minute games and 1–30 minute changeovers';
  end if;
  select * into d from public.rain_mode_draws where session_id=p_session_id for update;
  if not found or not d.active or d.fingerprint is distinct from p_fingerprint or not (d.draw ? 'settings') then
    raise exception 'The active rain draw does not match this page';
  end if;
  -- Serialize against score writes; even a saved 0–0 locks timing.
  perform 1 from public.rain_mode_scores where session_id=p_session_id for update;
  if exists(select 1 from public.rain_mode_scores where session_id=p_session_id and (revision>0 or team_a is not null)) then
    raise exception 'Timing is locked because scores have already been saved';
  end if;
  count_rounds := jsonb_array_length(d.draw->'rounds');
  start_min := split_part(p_start,':',1)::integer*60+split_part(p_start,':',2)::integer;
  cutoff_min := split_part(d.draw#>>'{settings,cutoff}',':',1)::integer*60+split_part(d.draw#>>'{settings,cutoff}',':',2)::integer;
  if cutoff_min is null or start_min+count_rounds*p_game_minutes+(count_rounds-1)*p_break_minutes>cutoff_min then
    raise exception 'This schedule runs past the finish cutoff. No games were shortened or removed';
  end if;
  select jsonb_agg(item || jsonb_build_object(
    'startsAt',to_char(timestamp '2000-01-01'+make_interval(mins=>start_min+(ord::integer-1)*(p_game_minutes+p_break_minutes)),'HH24:MI'),
    'endsAt',to_char(timestamp '2000-01-01'+make_interval(mins=>start_min+(ord::integer-1)*(p_game_minutes+p_break_minutes)+p_game_minutes),'HH24:MI')
  ) order by ord) into updated_rounds from jsonb_array_elements(d.draw->'rounds') with ordinality as r(item,ord);
  update public.rain_mode_draws set draw=jsonb_set(jsonb_set(d.draw,'{rounds}',updated_rounds),'{settings}',
    (d.draw->'settings') || jsonb_build_object('startTime',p_start,'gameMinutes',p_game_minutes,'changeoverMinutes',p_break_minutes))
    where session_id=p_session_id;
  -- Fingerprint and score keys identify pairings, not their clock times.
end;
$$;
revoke all on function public.update_rain_mode_timing(uuid,text,text,integer,integer) from public, anon;
grant execute on function public.update_rain_mode_timing(uuid,text,text,integer,integer) to authenticated;
