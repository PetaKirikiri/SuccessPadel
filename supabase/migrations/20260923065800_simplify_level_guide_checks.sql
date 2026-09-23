-- Short, scannable club self-assessment. Other guide content remains available.
begin;
update public.padel_skill_level_guides set self_checks =
 '[{"area":"Rallies","text":"Short rallies · little control"},{"area":"Serve & return","text":"Often miss serves or returns"},{"area":"Glass","text":"Struggle with back & double glass"},{"area":"Positioning","text":"Unsure where to stand"}]'::jsonb,
 updated_at = now()
where level_code = 'beginner' and locale = 'en';
update public.padel_skill_level_guides set self_checks =
 '[{"area":"Rallies","text":"Steady rallies at a gentle pace"},{"area":"Serve & return","text":"Usually get the point started"},{"area":"Glass","text":"Simple back glass · double glass difficult"},{"area":"Positioning","text":"Move as a pair · still leave gaps"}]'::jsonb,
 updated_at = now()
where level_code = 'low_inter' and locale = 'en';
commit;
