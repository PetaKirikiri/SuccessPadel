// Produces guarded SQL only; no network calls or implicit writes.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const draw=JSON.parse(readFileSync(new URL('../src/surfaces/rain-test/rain-draw-2026-10-28.json',import.meta.url),'utf8'));
export const fingerprint=createHash('sha256').update(JSON.stringify({players:draw.players.map(p=>[p.name,p.rosterId]),courtLabels:draw.courtLabels,courtIds:draw.courtIds,rounds:draw.rounds})).digest('hex');
export function tonightRainSeedSql(){
 const literal=JSON.stringify(draw).replaceAll("'","''");
 const roster=JSON.stringify(draw.players.map(p=>[p.rosterId,p.id])).replaceAll("'","''");
 return `begin;
 set local lock_timeout='5s';
 set local statement_timeout='15s';
 do $$ begin
   perform 1 from public.game_sessions where id='${draw.competitionId}' for update;
   if not exists(select 1 from public.game_sessions where id='${draw.competitionId}' and status='open' and competition_started_at is null and starts_on='2026-10-28') then
     raise exception 'Tonight is not an unstarted October 28 competition. Nothing changed';
   end if;
   if exists(select 1 from public.competition_rounds where session_id='${draw.competitionId}') then
     raise exception 'Normal competition rounds already exist. Nothing changed';
   end if;
   if (select jsonb_agg(jsonb_build_array(id::text,profile_id::text) order by rank_order) from public.session_players where session_id='${draw.competitionId}') is distinct from '${roster}'::jsonb then
     raise exception 'The roster changed after inspection. Nothing changed';
   end if;
 end $$;
 insert into public.rain_mode_draws(session_id,fingerprint,draw)
 values('${draw.competitionId}','${fingerprint}','${literal}'::jsonb) on conflict(session_id) do nothing;
 do $$ begin
   if not exists(select 1 from public.rain_mode_draws where session_id='${draw.competitionId}' and fingerprint='${fingerprint}' and draw='${literal}'::jsonb) then
     raise exception 'A different rain draw already exists. Nothing replaced';
   end if;
 end $$;
 insert into public.rain_mode_scores(session_id,game_number,court_slot)
 select '${draw.competitionId}',g,c from generate_series(1,10) g cross join generate_series(1,2) c
 on conflict(session_id,game_number,court_slot) do nothing;
 commit;`;
}
