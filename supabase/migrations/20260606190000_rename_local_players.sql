-- Rename seeded test players to local club roster names.
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
  v_i int;
  v_email text;
begin
  for v_i in 1..array_length(v_names, 1) loop
    v_email := 'player' || v_i || '@fake.successpadel.test';

    update public.profiles p
    set display_name = v_names[v_i]
    from auth.users u
    where u.id = p.id
      and u.email = v_email;

    update auth.users u
    set
      raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('display_name', v_names[v_i]),
      updated_at = now()
    where u.email = v_email;
  end loop;
end $$;
