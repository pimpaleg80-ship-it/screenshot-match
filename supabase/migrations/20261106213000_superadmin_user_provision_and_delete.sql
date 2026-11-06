-- 20261106213000_superadmin_user_provision_and_delete.sql
-- Fix superadmin provision user (attach org, location, roles) and add superadmin_delete_user RPC

-- 1. Upgraded superadmin_provision_user
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
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_user_id uuid;
  v_emp_id uuid;
  v_existing_id uuid;
  v_role public.app_role;
  v_org_role text;
  v_is_super boolean := false;
  v_hash text;
  v_org_id uuid;
  v_work_loc_id uuid;
BEGIN
  -- Resolve role mappings
  IF p_role = 'superadmin' THEN
    v_role := 'admin'::public.app_role;
    v_org_role := 'super_admin';
    v_is_super := true;
  ELSIF p_role = 'admin' THEN
    v_role := 'admin'::public.app_role;
    v_org_role := 'org_admin';
    v_is_super := false;
  ELSIF p_role = 'manager' THEN
    v_role := 'manager'::public.app_role;
    v_org_role := 'hr_manager';
    v_is_super := false;
  ELSE
    v_role := 'employee'::public.app_role;
    v_org_role := 'employee';
    v_is_super := false;
  END IF;

  -- Resolve organization_id
  SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Resolve primary active work location
  SELECT id INTO v_work_loc_id FROM public.work_locations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;

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

    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_org_id, v_user_id, v_org_role, 'active')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = v_org_role, status = 'active';

    UPDATE public.employees
    SET full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
        department_id = COALESCE(p_department_id, department_id),
        designation = COALESCE(NULLIF(trim(p_designation), ''), designation),
        phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
        organization_id = COALESCE(organization_id, v_org_id),
        work_location_id = COALESCE(work_location_id, v_work_loc_id),
        is_superadmin = v_is_super,
        status = 'active'
    WHERE user_id = v_user_id
    RETURNING id INTO v_emp_id;

    IF v_emp_id IS NULL THEN
      INSERT INTO public.employees (
        user_id,
        organization_id,
        work_location_id,
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
        v_org_id,
        v_work_loc_id,
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

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_user_id,
      'employee_id', v_emp_id,
      'is_superadmin', v_is_super,
      'action', 'updated'
    );
  END IF;

  -- Create new user
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

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_org_id, v_user_id, v_org_role, 'active')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = v_org_role, status = 'active';

  -- Update employee row that may have been created by auth.users trigger
  UPDATE public.employees
  SET full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
      department_id = COALESCE(p_department_id, department_id),
      designation = COALESCE(NULLIF(trim(p_designation), ''), designation),
      phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
      organization_id = COALESCE(organization_id, v_org_id),
      work_location_id = COALESCE(work_location_id, v_work_loc_id),
      is_superadmin = v_is_super,
      status = 'active'
  WHERE user_id = v_user_id
  RETURNING id INTO v_emp_id;

  IF v_emp_id IS NULL THEN
    INSERT INTO public.employees (
      user_id,
      organization_id,
      work_location_id,
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
      v_org_id,
      v_work_loc_id,
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

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'employee_id', v_emp_id,
    'is_superadmin', v_is_super,
    'action', 'created'
  );
END;
$$;

-- 2. Dedicated superadmin_delete_user RPC
CREATE OR REPLACE FUNCTION public.superadmin_delete_user(
  p_target_user_id uuid,
  p_employee_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_caller uuid := (select auth.uid());
  v_emp_id uuid := p_employee_id;
  v_user_id uuid := p_target_user_id;
BEGIN
  -- Prevent deleting self
  IF v_user_id IS NOT NULL AND v_caller = v_user_id THEN
    RAISE EXCEPTION 'Safety check: Cannot delete your own active account.';
  END IF;

  -- Resolve employee_id if not passed
  IF v_emp_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT id INTO v_emp_id FROM public.employees WHERE user_id = v_user_id LIMIT 1;
  END IF;

  -- Resolve user_id if not passed
  IF v_user_id IS NULL AND v_emp_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id FROM public.employees WHERE id = v_emp_id LIMIT 1;
  END IF;

  -- 1. Disassociate manager/admin references in other tables
  IF v_emp_id IS NOT NULL THEN
    UPDATE public.employees SET manager_id = NULL WHERE manager_id = v_emp_id;
    UPDATE public.leave_requests SET manager_id = NULL WHERE manager_id = v_emp_id;
    UPDATE public.leave_requests SET admin_id = NULL WHERE admin_id = v_emp_id;
    UPDATE public.attendance_exceptions SET reviewed_by = NULL WHERE reviewed_by = v_emp_id;

    -- Delete cascading records tied to employee
    DELETE FROM public.face_data WHERE employee_id = v_emp_id;
    DELETE FROM public.registered_devices WHERE employee_id = v_emp_id;
    DELETE FROM public.employee_location_assignments WHERE employee_id = v_emp_id;
    DELETE FROM public.employee_shift_assignments WHERE employee_id = v_emp_id;
    DELETE FROM public.geofence_events WHERE employee_id = v_emp_id;
    DELETE FROM public.attendance WHERE employee_id = v_emp_id;
    DELETE FROM public.leave_balances WHERE employee_id = v_emp_id;
    DELETE FROM public.leave_requests WHERE employee_id = v_emp_id;
    DELETE FROM public.attendance_monthly_summaries WHERE employee_id = v_emp_id;
    DELETE FROM public.attendance_exceptions WHERE employee_id = v_emp_id;
    DELETE FROM public.archive_files WHERE employee_id = v_emp_id;

    -- Delete employee
    DELETE FROM public.employees WHERE id = v_emp_id;
  END IF;

  -- 2. Clean up user_roles and organization_members
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    DELETE FROM public.organization_members WHERE user_id = v_user_id;
    UPDATE public.audit_logs SET user_id = NULL WHERE user_id = v_user_id;
    UPDATE public.audit_logs SET target_user_id = NULL WHERE target_user_id = v_user_id;

    -- Delete auth records
    DELETE FROM auth.identities WHERE user_id = v_user_id;
    DELETE FROM auth.sessions WHERE user_id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_user_id', v_user_id,
    'deleted_employee_id', v_emp_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_provision_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_delete_user TO authenticated;
