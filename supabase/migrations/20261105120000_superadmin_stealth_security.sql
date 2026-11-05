-- 20261105120000_superadmin_stealth_security.sql
-- Superadmin stealth role matrix, system functions, and security extensions

-- 1. Employees is_superadmin column and indices
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS is_superadmin boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_is_superadmin 
ON public.employees(is_superadmin);

CREATE INDEX IF NOT EXISTS idx_employees_user_id 
ON public.employees(user_id);

-- 2. Settings duplicate_scan_minutes
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS duplicate_scan_minutes integer DEFAULT 3;

-- 3. Audit logs user_email and target_user_id
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS target_user_id uuid;

-- 4. Helper function: is_superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_superadmin FROM public.employees WHERE user_id = _user_id LIMIT 1),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO anon;

-- 5. Helper function: superadmin_toggle_user_status
CREATE OR REPLACE FUNCTION public.superadmin_toggle_user_status(
  p_target_user_id uuid,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := CASE WHEN p_active THEN 'active' ELSE 'inactive' END;
BEGIN
  UPDATE public.employees
  SET status = v_status,
      updated_at = now()
  WHERE user_id = p_target_user_id;

  IF NOT p_active THEN
    UPDATE auth.users
    SET banned_until = '2099-01-01 00:00:00+00'::timestamptz,
        updated_at = now()
    WHERE id = p_target_user_id;
  ELSE
    UPDATE auth.users
    SET banned_until = NULL,
        updated_at = now()
    WHERE id = p_target_user_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'SUPERADMIN_STATUS_TOGGLE',
    jsonb_build_object('target_user_id', p_target_user_id, 'active', p_active, 'status', v_status),
    p_target_user_id
  );

  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_toggle_user_status(uuid, boolean) TO authenticated;

-- 6. Helper function: superadmin_reset_user_password
CREATE OR REPLACE FUNCTION public.superadmin_reset_user_password(
  p_target_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(trim(p_new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(trim(p_new_password), gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_target_user_id;

  INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'SUPERADMIN_PASSWORD_RESET',
    jsonb_build_object('target_user_id', p_target_user_id),
    p_target_user_id
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_reset_user_password(uuid, text) TO authenticated;

-- 7. Helper function: superadmin_set_user_role
CREATE OR REPLACE FUNCTION public.superadmin_set_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_is_super boolean := false;
BEGIN
  IF p_new_role = 'superadmin' THEN
    v_role := 'admin'::public.app_role;
    v_is_super := true;
  ELSIF p_new_role = 'admin' THEN
    v_role := 'admin'::public.app_role;
    v_is_super := false;
  ELSIF p_new_role = 'manager' THEN
    v_role := 'manager'::public.app_role;
    v_is_super := false;
  ELSIF p_new_role = 'employee' THEN
    v_role := 'employee'::public.app_role;
    v_is_super := false;
  ELSE
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_target_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_target_user_id, v_role);

  UPDATE public.employees
  SET is_superadmin = v_is_super
  WHERE user_id = p_target_user_id;

  INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'SUPERADMIN_ROLE_CHANGE',
    jsonb_build_object('target_user_id', p_target_user_id, 'new_role', p_new_role, 'is_superadmin', v_is_super),
    p_target_user_id
  );

  RETURN jsonb_build_object('success', true, 'new_role', p_new_role, 'is_superadmin', v_is_super);
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_set_user_role(uuid, text) TO authenticated;

-- 8. Helper function: superadmin_provision_user
CREATE OR REPLACE FUNCTION public.superadmin_provision_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_department_id uuid DEFAULT NULL,
  p_designation text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_emp_id uuid;
  v_existing_id uuid;
  v_role public.app_role;
  v_is_super boolean := false;
  v_hash text;
BEGIN
  IF p_role = 'superadmin' THEN
    v_role := 'admin'::public.app_role;
    v_is_super := true;
  ELSIF p_role = 'admin' THEN
    v_role := 'admin'::public.app_role;
    v_is_super := false;
  ELSIF p_role = 'manager' THEN
    v_role := 'manager'::public.app_role;
    v_is_super := false;
  ELSE
    v_role := 'employee'::public.app_role;
    v_is_super := false;
  END IF;

  -- Check existing user
  SELECT id INTO v_existing_id FROM auth.users WHERE email = lower(trim(p_email));

  IF v_existing_id IS NOT NULL THEN
    v_user_id := v_existing_id;

    IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
      UPDATE auth.users
      SET encrypted_password = crypt(trim(p_password), gen_salt('bf', 10)),
          updated_at = now()
      WHERE id = v_user_id;
    END IF;

    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, v_role);

    UPDATE public.employees
    SET full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
        department_id = COALESCE(p_department_id, department_id),
        designation = COALESCE(NULLIF(trim(p_designation), ''), designation),
        phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
        is_superadmin = v_is_super,
        status = 'active'
    WHERE user_id = v_user_id
    RETURNING id INTO v_emp_id;

    IF v_emp_id IS NULL THEN
      INSERT INTO public.employees (
        user_id,
        employee_code,
        full_name,
        email,
        phone,
        department_id,
        designation,
        is_superadmin,
        status
      ) VALUES (
        v_user_id,
        'EMP' || lpad(nextval('public.employee_code_seq')::text, 3, '0'),
        p_full_name,
        lower(trim(p_email)),
        p_phone,
        p_department_id,
        p_designation,
        v_is_super,
        'active'
      )
      RETURNING id INTO v_emp_id;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
    VALUES (
      auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'SUPERADMIN_UPDATE_USER',
      jsonb_build_object('email', p_email, 'role', p_role, 'is_superadmin', v_is_super),
      v_user_id
    );

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_user_id,
      'employee_id', v_emp_id,
      'is_superadmin', v_is_super,
      'action', 'updated'
    );
  END IF;

  -- Create new user with valid GoTrue empty strings
  v_user_id := gen_random_uuid();
  v_hash := crypt(COALESCE(NULLIF(trim(p_password), ''), 'Welcome@2026'), gen_salt('bf', 10));

  INSERT INTO auth.users (
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
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    email_change_confirm_status,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    lower(trim(p_email)),
    v_hash,
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('sub', v_user_id, 'name', p_full_name, 'email', lower(trim(p_email)), 'email_verified', true, 'phone_verified', false),
    false,
    false,
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id, 'email', lower(trim(p_email)), 'email_verified', true, 'phone_verified', false),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, v_role);

  INSERT INTO public.employees (
    user_id,
    employee_code,
    full_name,
    email,
    phone,
    department_id,
    designation,
    is_superadmin,
    status
  ) VALUES (
    v_user_id,
    'EMP' || lpad(nextval('public.employee_code_seq')::text, 3, '0'),
    p_full_name,
    lower(trim(p_email)),
    p_phone,
    p_department_id,
    p_designation,
    v_is_super,
    'active'
  )
  RETURNING id INTO v_emp_id;

  INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'SUPERADMIN_PROVISION_USER',
    jsonb_build_object('email', p_email, 'role', p_role, 'is_superadmin', v_is_super),
    v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'employee_id', v_emp_id,
    'is_superadmin', v_is_super,
    'action', 'created'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_provision_user(text, text, text, text, uuid, text, text) TO authenticated;

