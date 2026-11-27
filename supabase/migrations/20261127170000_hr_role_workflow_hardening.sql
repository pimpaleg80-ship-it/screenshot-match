-- ============================================================================
-- Migration: Harden Superadmin -> Admin (HR) -> Manager / Employee Auth & RBAC
-- ============================================================================

-- 1. Harden superadmin_provision_user so pre-existing auth users without an
--    employee row are repaired cleanly, and HR Admin default title reflects HR.
CREATE OR REPLACE FUNCTION public.superadmin_provision_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_department_id uuid DEFAULT NULL::uuid,
  p_designation text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_organization_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
  v_user_id uuid;
  v_emp_id uuid;
  v_existing_id uuid;
  v_role public.app_role;
  v_org_role text;
  v_is_super boolean := false;
  v_org_id uuid;
  v_work_loc_id uuid;
  v_clean_email text;
  v_clean_name text;
  v_hash text;
  v_norm_role text;
  v_code text;
  v_default_desig text;
BEGIN
  IF v_jwt_role = 'anon' OR (v_caller IS NULL AND v_jwt_role <> 'service_role') OR (v_caller IS NOT NULL AND NOT public.is_superadmin(v_caller)) THEN
    RAISE EXCEPTION 'Forbidden: Root Superadmin access required.' USING ERRCODE = '42501';
  END IF;

  v_clean_email := lower(trim(p_email));
  v_clean_name := trim(p_full_name);
  v_norm_role := lower(trim(COALESCE(p_role, 'employee')));

  IF v_clean_email IS NULL OR v_clean_email = '' THEN
    RAISE EXCEPTION 'Email is required.';
  END IF;
  IF v_clean_name IS NULL OR v_clean_name = '' THEN
    RAISE EXCEPTION 'Full name is required.';
  END IF;

  IF v_norm_role IN ('superadmin', 'super_admin') THEN
    v_role := 'admin'::public.app_role;
    v_org_role := 'super_admin';
    v_is_super := true;
    v_norm_role := 'superadmin';
    v_default_desig := 'Root Super Administrator';
  ELSIF v_norm_role IN ('admin', 'hr', 'hr_admin') THEN
    v_norm_role := 'admin';
    v_role := 'admin'::public.app_role;
    v_org_role := 'org_admin';
    v_default_desig := 'HR Administrator';
  ELSIF v_norm_role = 'manager' THEN
    v_role := 'manager'::public.app_role;
    v_org_role := 'hr_manager';
    v_default_desig := 'Team Manager';
  ELSE
    v_norm_role := 'employee';
    v_role := 'employee'::public.app_role;
    v_org_role := 'employee';
    v_default_desig := 'Staff';
  END IF;

  IF p_organization_id IS NOT NULL THEN
    v_org_id := p_organization_id;
  ELSE
    SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
    IF v_org_id IS NULL THEN
      v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
    END IF;
  END IF;

  SELECT id INTO v_work_loc_id
  FROM public.work_locations
  WHERE organization_id = v_org_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = v_clean_email;

  IF v_existing_id IS NOT NULL THEN
    v_user_id := v_existing_id;
    IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
      v_hash := extensions.crypt(trim(p_password), extensions.gen_salt('bf', 10));
    ELSE
      v_hash := NULL;
    END IF;

    UPDATE auth.users
    SET
      encrypted_password          = COALESCE(v_hash, encrypted_password),
      email_confirmed_at          = COALESCE(email_confirmed_at, now()),
      confirmation_token          = COALESCE(confirmation_token, ''),
      recovery_token              = COALESCE(recovery_token, ''),
      email_change_token_new      = COALESCE(email_change_token_new, ''),
      email_change                = COALESCE(email_change, ''),
      email_change_token_current  = COALESCE(email_change_token_current, ''),
      phone_change                = COALESCE(phone_change, ''),
      phone_change_token          = COALESCE(phone_change_token, ''),
      reauthentication_token      = COALESCE(reauthentication_token, ''),
      email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
      is_sso_user                 = COALESCE(is_sso_user, false),
      is_anonymous                = COALESCE(is_anonymous, false),
      raw_app_meta_data           = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', v_norm_role),
      raw_user_meta_data          = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('sub', v_user_id::text, 'name', v_clean_name, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
      updated_at                  = now()
    WHERE id = v_user_id;

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
      'email',
      v_user_id::text,
      now(), now(), now()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = now();

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, v_role)
    ON CONFLICT (user_id) DO UPDATE SET role = v_role;

    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_org_id, v_user_id, v_org_role, 'active')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = v_org_role, status = 'active';

    UPDATE public.employees
    SET
      full_name        = COALESCE(NULLIF(v_clean_name, ''), full_name),
      department_id    = COALESCE(p_department_id, department_id),
      designation      = COALESCE(NULLIF(trim(p_designation), ''), designation, v_default_desig),
      phone            = COALESCE(NULLIF(trim(p_phone), ''), phone),
      organization_id  = COALESCE(p_organization_id, organization_id, v_org_id),
      work_location_id = CASE WHEN v_is_super THEN NULL ELSE COALESCE(work_location_id, v_work_loc_id) END,
      is_superadmin    = (is_superadmin OR v_is_super),
      status           = 'active',
      user_id          = v_user_id,
      updated_at       = now()
    WHERE user_id = v_user_id OR lower(email) = v_clean_email
    RETURNING id INTO v_emp_id;

    IF v_emp_id IS NULL THEN
      v_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
      WHILE EXISTS (SELECT 1 FROM public.employees WHERE lower(employee_code) = lower(v_code)) LOOP
        v_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
      END LOOP;

      INSERT INTO public.employees (
        user_id, organization_id, work_location_id, employee_code, full_name, email, phone,
        department_id, designation, is_superadmin, status
      ) VALUES (
        v_user_id, v_org_id, CASE WHEN v_is_super THEN NULL ELSE v_work_loc_id END,
        v_code, v_clean_name, v_clean_email, NULLIF(trim(p_phone), ''),
        p_department_id, COALESCE(NULLIF(trim(p_designation), ''), v_default_desig),
        v_is_super, 'active'
      )
      RETURNING id INTO v_emp_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'updated',
      'user_id', v_user_id,
      'employee_id', v_emp_id,
      'organization_id', v_org_id,
      'email', v_clean_email,
      'role', v_norm_role,
      'is_superadmin', v_is_super,
      'status', 'updated'
    );
  END IF;

  IF p_password IS NULL OR length(trim(p_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  v_user_id := gen_random_uuid();
  v_hash := extensions.crypt(trim(p_password), extensions.gen_salt('bf', 10));

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    email_change_confirm_status, raw_app_meta_data, raw_user_meta_data,
    is_sso_user, is_anonymous, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    v_hash,
    now(),
    '', '', '', '', '', '', '', '', 0,
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', v_norm_role),
    jsonb_build_object('sub', v_user_id::text, 'name', v_clean_name, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
    false,
    false,
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, v_role)
  ON CONFLICT (user_id) DO UPDATE SET role = v_role;

  DELETE FROM public.organization_members
  WHERE user_id = v_user_id AND organization_id <> v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_org_id, v_user_id, v_org_role, 'active')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = v_org_role, status = 'active';

  UPDATE public.employees
  SET
    full_name        = v_clean_name,
    department_id    = p_department_id,
    designation      = COALESCE(NULLIF(trim(p_designation), ''), v_default_desig),
    phone            = NULLIF(trim(p_phone), ''),
    organization_id  = v_org_id,
    work_location_id = CASE WHEN v_is_super THEN NULL ELSE v_work_loc_id END,
    is_superadmin    = v_is_super,
    status           = 'active',
    user_id          = v_user_id,
    updated_at       = now()
  WHERE user_id = v_user_id OR lower(email) = v_clean_email
  RETURNING id INTO v_emp_id;

  IF v_emp_id IS NULL THEN
    v_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
    WHILE EXISTS (SELECT 1 FROM public.employees WHERE lower(employee_code) = lower(v_code)) LOOP
      v_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
    END LOOP;

    INSERT INTO public.employees (
      user_id, organization_id, work_location_id, employee_code, full_name, email, phone,
      department_id, designation, is_superadmin, status
    ) VALUES (
      v_user_id, v_org_id, CASE WHEN v_is_super THEN NULL ELSE v_work_loc_id END,
      v_code, v_clean_name, v_clean_email, NULLIF(trim(p_phone), ''),
      p_department_id, COALESCE(NULLIF(trim(p_designation), ''), v_default_desig),
      v_is_super, 'active'
    )
    RETURNING id INTO v_emp_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'created',
    'user_id', v_user_id,
    'employee_id', v_emp_id,
    'organization_id', v_org_id,
    'email', v_clean_email,
    'role', v_norm_role,
    'is_superadmin', v_is_super,
    'status', 'created'
  );
END;
$$;

-- 2. Harden manage_org_user_role:
--    - Only Superadmin can modify Admin (HR) accounts or self
--    - HR Admin switches org users cleanly between 'manager' and 'employee'
--    - Upserts organization_members safely so missing rows are always repaired
CREATE OR REPLACE FUNCTION public.manage_org_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := (SELECT auth.uid());
  v_jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
  v_caller_is_super boolean := false;
  v_caller_is_admin boolean := false;
  v_caller_org_id uuid;
  v_target_org_id uuid;
  v_norm_role text := lower(trim(COALESCE(p_new_role, '')));
  v_app_role public.app_role;
  v_org_role text;
BEGIN
  IF v_jwt_role = 'anon' OR (v_caller_uid IS NULL AND v_jwt_role <> 'service_role') THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_uid IS NOT NULL THEN
    v_caller_is_super := public.is_superadmin(v_caller_uid);
    v_caller_is_admin := NOT v_caller_is_super AND (
      public.has_role(v_caller_uid, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = v_caller_uid AND om.status = 'active' AND om.role = 'org_admin'
      )
    );
    IF NOT (v_caller_is_super OR v_caller_is_admin) THEN
      RAISE EXCEPTION 'Forbidden: Only HR Administrators can manage team roles.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    v_caller_is_super := true;
  END IF;

  -- Never reveal or allow edits to Root Superadmin from organization tools
  IF NOT v_caller_is_super AND public.is_superadmin(p_target_user_id) THEN
    RAISE EXCEPTION 'Account not found in organization.' USING ERRCODE = 'P0002';
  END IF;

  SELECT organization_id INTO v_target_org_id
  FROM public.employees
  WHERE user_id = p_target_user_id
    AND (v_caller_is_super OR is_superadmin IS NOT TRUE)
  LIMIT 1;

  IF NOT v_caller_is_super THEN
    v_caller_org_id := public.current_employee_org_id();

    IF v_target_org_id IS NULL OR v_caller_org_id IS NULL OR v_target_org_id <> v_caller_org_id THEN
      RAISE EXCEPTION 'Account not found in organization.' USING ERRCODE = 'P0002';
    END IF;

    IF p_target_user_id = v_caller_uid THEN
      RAISE EXCEPTION 'Safety check: Cannot change your own HR Admin role.'
        USING ERRCODE = '42501';
    END IF;

    IF public.has_role(p_target_user_id, 'admin'::public.app_role)
       OR EXISTS (
         SELECT 1 FROM public.organization_members om
         WHERE om.user_id = p_target_user_id
           AND om.organization_id = v_caller_org_id
           AND om.role = 'org_admin'
       ) THEN
      RAISE EXCEPTION 'Forbidden: Only Root Superadmin can modify HR Admin accounts.'
        USING ERRCODE = '42501';
    END IF;

    IF v_norm_role NOT IN ('manager', 'employee') THEN
      RAISE EXCEPTION 'Forbidden: HR Administrators can only assign Manager or Employee roles.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF v_norm_role NOT IN ('admin', 'manager', 'employee') THEN
      RAISE EXCEPTION 'Invalid role %. Use superadmin console for Root changes.', p_new_role;
    END IF;
  END IF;

  IF v_norm_role = 'admin' THEN
    v_app_role := 'admin'::public.app_role;
    v_org_role := 'org_admin';
  ELSIF v_norm_role = 'manager' THEN
    v_app_role := 'manager'::public.app_role;
    v_org_role := 'hr_manager';
  ELSE
    v_app_role := 'employee'::public.app_role;
    v_org_role := 'employee';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_target_user_id, v_app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = v_app_role;

  IF COALESCE(v_target_org_id, v_caller_org_id) IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (COALESCE(v_target_org_id, v_caller_org_id), p_target_user_id, v_org_role, 'active')
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = v_org_role, status = 'active';
  END IF;

  UPDATE public.employees
  SET updated_at = now()
  WHERE user_id = p_target_user_id;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_norm_role),
      updated_at = now()
  WHERE id = p_target_user_id;

  INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
  VALUES (
    v_caller_uid,
    (SELECT email FROM auth.users WHERE id = v_caller_uid),
    'ORG_ROLE_CHANGE',
    jsonb_build_object('target_user_id', p_target_user_id, 'new_role', v_norm_role, 'org_role', v_org_role),
    p_target_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'new_role', v_norm_role,
    'org_role', v_org_role
  );
END;
$$;

-- 3. Clean up candidate_interviews FK in superadmin_delete_user so deletion never fails
CREATE OR REPLACE FUNCTION public.superadmin_delete_user(
  p_target_user_id uuid,
  p_employee_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
  v_emp_id uuid := p_employee_id;
  v_user_id uuid := p_target_user_id;
BEGIN
  IF v_jwt_role = 'anon' OR (v_caller IS NULL AND v_jwt_role <> 'service_role') OR (v_caller IS NOT NULL AND NOT public.is_superadmin(v_caller)) THEN
    RAISE EXCEPTION 'Forbidden: Root Superadmin access required.' USING ERRCODE = '42501';
  END IF;

  IF v_emp_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT id INTO v_emp_id FROM public.employees WHERE user_id = v_user_id LIMIT 1;
  END IF;
  IF v_user_id IS NULL AND v_emp_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id FROM public.employees WHERE id = v_emp_id LIMIT 1;
  END IF;

  IF v_caller IS NOT NULL AND v_user_id IS NOT NULL AND v_caller = v_user_id THEN
    RAISE EXCEPTION 'Safety check: Cannot delete your own active account.';
  END IF;

  IF v_emp_id IS NOT NULL THEN
    UPDATE public.employees SET manager_id = NULL WHERE manager_id = v_emp_id;
    UPDATE public.leave_requests SET manager_id = NULL WHERE manager_id = v_emp_id;
    UPDATE public.leave_requests SET admin_id = NULL WHERE admin_id = v_emp_id;
    UPDATE public.attendance_exceptions SET reviewed_by = NULL WHERE reviewed_by = v_emp_id;
    DELETE FROM public.candidate_interviews WHERE interviewer_id = v_emp_id;

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
    DELETE FROM public.employees WHERE id = v_emp_id;
  END IF;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    DELETE FROM public.organization_members WHERE user_id = v_user_id;
    UPDATE public.audit_logs SET user_id = NULL WHERE user_id = v_user_id;
    UPDATE public.audit_logs SET target_user_id = NULL WHERE target_user_id = v_user_id;
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

REVOKE ALL ON FUNCTION public.superadmin_provision_user(text, text, text, text, uuid, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manage_org_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.superadmin_delete_user(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.superadmin_provision_user(text, text, text, text, uuid, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manage_org_user_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.superadmin_delete_user(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
