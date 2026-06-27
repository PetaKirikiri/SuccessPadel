-- Let signed-out browsers see public friendly games on the home board.
grant execute on function public.list_public_friendly_sessions() to anon;
