-- Admins can upload profile photos for any player (path is profiles.id, not auth.uid()).

create policy avatars_admin_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars' and public.is_admin());

create policy avatars_admin_update on storage.objects
  for update
  to authenticated
  using (bucket_id = 'avatars' and public.is_admin())
  with check (bucket_id = 'avatars' and public.is_admin());

create policy avatars_admin_delete on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'avatars' and public.is_admin());
