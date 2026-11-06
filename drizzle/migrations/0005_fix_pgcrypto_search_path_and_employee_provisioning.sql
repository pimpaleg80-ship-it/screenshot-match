-- 0005_fix_pgcrypto_search_path_and_employee_provisioning.sql
-- Fix search_path and qualify extensions.crypt / extensions.gen_salt to resolve "function gen_salt(unknown, integer) does not exist"
-- Also handle trigger-generated employee records on auth.users insert to prevent "duplicate key value violates unique constraint 'employees_user_id_key'"

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. superadmin_provision_user
CREATE OR REPLACE FUNCTION public.superadmin_provision_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_department_id uuid DEFAULT NULL::uuid,
  p_designation text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = lower(trim(p_email));

  IF v_existing_id IS NOT NULL THEN
    v_user_id := v_existing_id;

    IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(trim(p_password), extensions.gen_salt('bf', 10)),
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
  v_hash := extensions.crypt(COALESCE(NULLIF(trim(p_password), ''), 'Welcome@2026'), extensions.gen_salt('bf', 10));

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
    '', '', '', '', '', '', '', '', 0,
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

  -- Update employee record created by auth.users trigger (or insert if not created)
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

-- 2. superadmin_reset_user_password
CREATE OR REPLACE FUNCTION public.superadmin_reset_user_password(
  p_target_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF length(trim(p_new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(trim(p_new_password), extensions.gen_salt('bf', 10)),
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

-- 3. admin_create_employee
CREATE OR REPLACE FUNCTION public.admin_create_employee(
  p_email text,
  p_password text,
  p_full_name text,
  p_department text DEFAULT 'General',
  p_phone text DEFAULT NULL,
  p_person_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_emp_id uuid;
  v_dept_id uuid;
  v_hash text;
  v_existing_id uuid;
  v_code text;
BEGIN
  -- Permission check: caller must be admin or superadmin
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Only administrators can create employees.';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required for employee login.';
  END IF;

  IF p_password IS NULL OR length(trim(p_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Full name is required.';
  END IF;

  -- Check if user already exists
  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'An account with email % already exists.', lower(trim(p_email));
  END IF;

  -- Check if employee already exists in public.employees
  IF EXISTS (SELECT 1 FROM public.employees WHERE lower(email) = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'An employee with email % already exists.', lower(trim(p_email));
  END IF;

  -- Department resolution
  IF p_department IS NOT NULL AND trim(p_department) <> '' THEN
    SELECT id INTO v_dept_id FROM public.departments WHERE lower(name) = lower(trim(p_department)) LIMIT 1;
    IF v_dept_id IS NULL THEN
      INSERT INTO public.departments (name) VALUES (trim(p_department)) RETURNING id INTO v_dept_id;
    END IF;
  END IF;

  -- Determine unique employee code
  v_code := NULLIF(trim(p_person_code), '');

  IF v_code IS NULL OR EXISTS (SELECT 1 FROM public.employees WHERE lower(employee_code) = lower(v_code)) THEN
    v_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
    WHILE EXISTS (SELECT 1 FROM public.employees WHERE lower(employee_code) = lower(v_code)) LOOP
      v_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
    END LOOP;
  END IF;

  -- Create Auth User
  v_user_id := gen_random_uuid();
  v_hash := extensions.crypt(trim(p_password), extensions.gen_salt('bf', 10));

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
    '', '', '', '', '', '', '', '', 0,
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', 'employee'),
    jsonb_build_object('sub', v_user_id, 'name', trim(p_full_name), 'email', lower(trim(p_email)), 'email_verified', true, 'phone_verified', false),
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

  -- Ensure role is employee
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'employee');

  -- Update employee if created by auth trigger
  UPDATE public.employees
  SET full_name = trim(p_full_name),
      department_id = v_dept_id,
      phone = NULLIF(trim(p_phone), ''),
      employee_code = v_code,
      designation = 'Employee',
      is_superadmin = false,
      status = 'active'
  WHERE user_id = v_user_id
  RETURNING id, employee_code INTO v_emp_id, v_code;

  -- If no employee was created by trigger, create it now
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
      v_code,
      trim(p_full_name),
      lower(trim(p_email)),
      NULLIF(trim(p_phone), ''),
      v_dept_id,
      'Employee',
      false,
      'active'
    )
    RETURNING id, employee_code INTO v_emp_id, v_code;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'employee_id', v_emp_id,
    'employee_code', v_code,
    'email', lower(trim(p_email))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_employee(text, text, text, text, text, text) TO authenticated;
