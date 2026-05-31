-- =============================================================================
-- TDL Drill & Blast — Demo Users Seed
-- รัน SQL นี้ใน Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- สร้างบัญชี:
--   admin   / admin    (role: admin)
--   manager / manager  (role: manager)
--
-- ถ้า user มีอยู่แล้ว (unconfirmed จาก signUp): จะ confirm + reset password
-- =============================================================================

DO $$
DECLARE
  v_id UUID;
BEGIN

  -- ── admin@tdl-drill.local ────────────────────────────────────────────────
  SELECT id INTO v_id FROM auth.users WHERE email = 'admin@tdl-drill.local';

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_id, 'authenticated', 'authenticated',
      'admin@tdl-drill.local',
      crypt('admin', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"username":"admin","display_name":"Admin User","role":"admin"}',
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      'admin@tdl-drill.local',
      v_id,
      jsonb_build_object('sub', v_id::text, 'email', 'admin@tdl-drill.local'),
      'email',
      now(), now(), now()
    );

    RAISE NOTICE 'Created admin user (id = %)', v_id;
  ELSE
    -- อัปเดต: confirm email + reset password
    UPDATE auth.users SET
      encrypted_password  = crypt('admin', gen_salt('bf')),
      email_confirmed_at  = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data  = raw_user_meta_data
                            || '{"username":"admin","display_name":"Admin User","role":"admin"}',
      updated_at          = now()
    WHERE id = v_id;

    RAISE NOTICE 'Updated admin user (id = %)', v_id;
  END IF;

  -- ── manager@tdl-drill.local ──────────────────────────────────────────────
  SELECT id INTO v_id FROM auth.users WHERE email = 'manager@tdl-drill.local';

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_id, 'authenticated', 'authenticated',
      'manager@tdl-drill.local',
      crypt('manager', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"username":"manager","display_name":"Site Manager","role":"manager"}',
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      'manager@tdl-drill.local',
      v_id,
      jsonb_build_object('sub', v_id::text, 'email', 'manager@tdl-drill.local'),
      'email',
      now(), now(), now()
    );

    RAISE NOTICE 'Created manager user (id = %)', v_id;
  ELSE
    UPDATE auth.users SET
      encrypted_password  = crypt('manager', gen_salt('bf')),
      email_confirmed_at  = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data  = raw_user_meta_data
                            || '{"username":"manager","display_name":"Site Manager","role":"manager"}',
      updated_at          = now()
    WHERE id = v_id;

    RAISE NOTICE 'Updated manager user (id = %)', v_id;
  END IF;

END $$;
