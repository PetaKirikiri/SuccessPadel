-- Success Padel self-assessment examples, not an external numerical rating.
insert into public.padel_skill_level_guides
(level_code, locale, summary, self_checks, next_level_focus, image_url, image_alt, status)
values
('beginner', 'en', 'You are learning to keep the ball in play.',
 '[{"area":"Rallies","text":"Easy balls sometimes go back, but direction and longer rallies are difficult."},{"area":"Serve & return","text":"Serve and return are still inconsistent."},{"area":"Glass","text":"Back-glass rebounds are unfamiliar. Double glass is not yet reliable."},{"area":"Positioning","text":"Still learning where to stand and how to move with a partner."}]'::jsonb,
 'Build steady rallies and learn to judge a simple back-glass rebound.',
 '/level-guides/rally.svg', 'Court diagram showing a simple rally between two players.', 'published'),
('low_inter', 'en', 'You can play rallies, but control is still developing.',
 '[{"area":"Rallies","text":"Can sustain steady rallies; faster or awkward balls still cause mistakes."},{"area":"Serve & return","text":"Usually gets the point started. Lobs and volleys still lack consistent placement."},{"area":"Glass","text":"Can return simple back-glass balls. Double glass remains unreliable."},{"area":"Positioning","text":"Starting to move as a pair, but sometimes leaves gaps or gets caught mid-court."}]'::jsonb,
 'Improve control, back-glass confidence and recovery after each shot.',
 '/level-guides/back-glass.svg', 'Court diagram showing a ball rebounding off the back glass towards a player.', 'published')
on conflict (level_code, locale) do update set
 summary=excluded.summary, self_checks=excluded.self_checks, next_level_focus=excluded.next_level_focus,
 image_url=excluded.image_url, image_alt=excluded.image_alt, status=excluded.status, updated_at=now();
