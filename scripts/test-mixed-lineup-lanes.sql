-- Run after the lane guard migration. All test moves are rolled back.
begin;
do $test$
declare
  event_id uuid := '882f0946-4cf7-4575-b6b4-982146f02479';
  session_before jsonb;
  roster_before jsonb;
  snapshot jsonb;
  slots uuid[];
  proposed uuid[];
  config jsonb;
  rpc text;
  admin_id uuid;
  i integer;
  j integer;
  group_index integer;
begin
  select id into admin_id from public.profiles where is_admin limit 1;
  if admin_id is null then raise exception 'No administrator available for rollback regression'; end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  select to_jsonb(s),scoring_config into session_before,config from public.game_sessions s where id=event_id;
  if config->>'operation_format' is distinct from 'mixed-americano' then raise exception 'Expected saved Halloween mixed event'; end if;
  select array_agg(id order by rank_order,id), jsonb_agg(to_jsonb(p) order by rank_order,id),
    jsonb_agg(jsonb_build_object('id',id,'profile_id',profile_id,'padel_player_id',padel_player_id,
      'guest_name',guest_name,'guest_email',guest_email,'rank_order',rank_order) order by rank_order,id)
    into slots,roster_before,snapshot from public.session_players p where session_id=event_id;
  if cardinality(slots) <> 16 then raise exception 'Expected sixteen saved slots'; end if;
  for i in 1..16 loop
    for j in 1..16 loop
      proposed := slots;
      proposed[i] := slots[j]; proposed[j] := slots[i];
      select ordinality into group_index from jsonb_array_elements(config->'mixed_groups') with ordinality
        where value ? slots[i]::text;
      if (config->'mixed_groups'->(group_index-1)) ? slots[j]::text then
        perform public.validate_mixed_lineup_order(config,slots,proposed);
      else
        begin
          perform public.validate_mixed_lineup_order(config,slots,proposed);
          raise exception 'Cross-column swap was accepted';
        exception when others then
          if sqlerrm <> 'Players must stay within their own mixed lineup column' then raise; end if;
        end;
      end if;
    end loop;
  end loop;
  foreach rpc in array array['public_competition_signup_reorder','reorder_competition_slot_occupants'] loop
    proposed := slots; proposed[1] := slots[9]; proposed[9] := slots[1];
    begin
      execute format('select public.%I($1,$2,$3)',rpc) using event_id,
        case when rpc='public_competition_signup_reorder' then (select jsonb_agg(value-'guest_email') from jsonb_array_elements(snapshot)) else snapshot end, proposed;
      raise exception 'Reorder endpoint accepted a cross-column move';
    exception when others then
      if sqlerrm <> 'Players must stay within their own mixed lineup column' then raise; end if;
    end;
    -- Successful moves stay in a subtransaction that is deliberately rolled back.
    proposed := slots; proposed[1] := slots[2]; proposed[2] := slots[1];
    begin
      execute format('select public.%I($1,$2,$3)',rpc) using event_id,
        case when rpc='public_competition_signup_reorder' then (select jsonb_agg(value-'guest_email') from jsonb_array_elements(snapshot)) else snapshot end, proposed;
      if (select to_jsonb(s) from public.game_sessions s where id=event_id) is distinct from session_before then
        raise exception 'Reorder changed session settings';
      end if;
      if exists(select 1 from public.session_players p where p.session_id=event_id and
        jsonb_build_object('id',p.id,'profile_id',p.profile_id,'padel_player_id',p.padel_player_id,
          'guest_name',p.guest_name,'guest_email',p.guest_email,'rank_order',p.rank_order)
        is distinct from ((snapshot->(array_position(slots,proposed[array_position(slots,p.id)])-1)) ||
          jsonb_build_object('id',p.id,'rank_order',roster_before->(array_position(slots,p.id)-1)->'rank_order'))) then
        raise exception 'Same-column move changed unexpected occupants';
      end if;
      raise exception 'rollback_successful_lane_test';
    exception when others then
      if sqlerrm <> 'rollback_successful_lane_test' then raise; end if;
    end;
  end loop;
  if (select jsonb_agg(to_jsonb(p) order by rank_order,id) from public.session_players p where session_id=event_id) is distinct from roster_before then
    raise exception 'Tests did not restore roster';
  end if;
end $test$;
rollback;
select 'Mixed lane validation and both reorder endpoints passed; test moves rolled back' as result;
