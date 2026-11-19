create table public.member_tier_board_state (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0,
  board jsonb
);
insert into public.member_tier_board_state default values;
alter table public.member_tier_board_state enable row level security;
revoke all on public.member_tier_board_state from public, anon, authenticated;

create function public.access_member_tier_board(
  p_access_token text default null,
  p_revision bigint default null,
  p_board jsonb default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare result jsonb;
begin
  if public.can_edit_member_directory(p_access_token) is not true then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if p_board is not null then
    if jsonb_typeof(p_board) <> 'object' or octet_length(p_board::text) > 100000 then
      raise exception 'Invalid tier board';
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
