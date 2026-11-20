create or replace function public.access_member_tier_board(
  p_access_token text default null,
  p_revision bigint default null,
  p_board jsonb default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare result jsonb;
begin
  if p_board is not null then
    if jsonb_typeof(p_board) <> 'object' or jsonb_typeof(p_board->'placements') is distinct from 'object'
       or jsonb_typeof(p_board->'hidden') is distinct from 'array'
       or jsonb_typeof(p_board->'addedMembers') is distinct from 'array'
       or octet_length(p_board::text) > 100000 then
      raise exception 'Invalid tier board';
    end if;
    if jsonb_path_exists(p_board, '$.placements.* ? (@.type() != "object")')
      or jsonb_path_exists(p_board, '$.placements.*.* ? (@.type() != "array")')
      or jsonb_path_exists(p_board, '$.placements.*.*[*] ? (@.type() != "string")')
      or jsonb_path_exists(p_board, '$.hidden[*] ? (@.type() != "string")')
      or jsonb_path_exists(p_board, '$.addedMembers[*] ? (@.type() != "string")') then
      raise exception 'Invalid ranking placements';
    end if;
    update public.member_tier_board_state
    set board = p_board, revision = revision + 1
    where singleton and revision = p_revision;
    if not found then raise exception 'The board changed on another device. Reload before saving.'; end if;
  end if;

  select jsonb_build_object('revision', s.revision, 'board', s.board) into result
  from public.member_tier_board_state s where singleton;
  return result;
end;
$$;
revoke all on function public.access_member_tier_board(text, bigint, jsonb) from public;
grant execute on function public.access_member_tier_board(text, bigint, jsonb) to anon, authenticated;
