-- Remove season-long duos entry from the competitions list.
delete from public.game_sessions
where title = 'Ranked Duos · Club Season';
