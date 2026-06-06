-- Local club players for roster pickers (not for login).
do $$
declare
  v_names text[] := array[
    'Bert',
    'Bia',
    'Tong',
    'Neung',
    'Kett',
    'Nam',
    'Kett',
    'Ui',
    'Golf Runner',
    'Golf Air',
    'Bond',
    'Pum',
    'Mango',
    'Jay',
    'Pai'
  ];
  v_name text;
  v_user_id uuid;
  v_i int := 0;
begin
  foreach v_name in array v_names loop
    v_i := v_i + 1;
    if exists (
      select 1 from public.profiles p where lower(p.display_name) = lower(v_name)
    ) then
      continue;
    end if;

    v_user_id := gen_random_uuid();

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
      'player' || v_i || '@fake.successpadel.test',
      crypt('FakePlayer123!', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', v_name),
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
      jsonb_build_object('sub', v_user_id::text, 'email', 'player' || v_i || '@fake.successpadel.test'),
      'email',
      now(),
      now(),
      now()
    );

    insert into public.profiles (id, display_name, is_admin)
    values (v_user_id, v_name, false)
    on conflict (id) do update set display_name = excluded.display_name;
  end loop;
end $$;
