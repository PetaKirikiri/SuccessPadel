-- Dev bootstrap account (email/password). Safe to run once on empty projects.
do $$
declare
  v_user_id uuid := 'b05d8411-63fc-4e5f-8926-3fc0fb927872';
begin
  if exists (select 1 from auth.users where email = 'owner@successpadel.app') then
    return;
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'owner@successpadel.app',
    crypt('SuccessPadel123!', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Owner"}'::jsonb,
    now(),
    now()
  );

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', 'owner@successpadel.app'),
    'email',
    now(),
    now(),
    now()
  );
end $$;
