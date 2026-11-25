-- ==============================================================================
-- FLOWPEOPLE — AUTH PIPELINE, RLS & EDGE SYNC HARDENING MIGRATION
-- Fixes:
-- 1. handle_new_user() trigger conflict target error (42P10)
-- 2. user_roles constraints and unique indexing for composite lookups
-- 3. superadmin_provision_user and admin_create_employee_v2 identity syncing
-- 4. system_secrets RLS policy for superadmins
-- 5. Full synchronization of auth.users, auth.identities, user_roles and employees
-- ==============================================================================

-- 1. Ensure composite unique index on user_roles for (user_id, role)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_id_role 
ON public.user_roles (user_id, role);

-- 2. Re-create handle_new_user() with robust role resolution and conflict handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  is_first boolean;
  assigned_role public.app_role;
  v_role_text text;
  emp_code text;
  v_default_org_id uuid;
  v_default_loc_id uuid;
  v_full_name text;
BEGIN
  -- Resolve role safely from raw_app_meta_data
  v_role_text := lower(trim(COALESCE(new.raw_app_meta_data->>'role', '')));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first THEN
    assigned_role := 'admin'::public.app_role;
  ELSIF v_role_text IN ('superadmin', 'super_admin', 'admin') THEN
    assigned_role := 'admin'::public.app_role;
  ELSIF v_role_text = 'manager' THEN
    assigned_role := 'manager'::public.app_role;
  ELSE
    assigned_role := 'employee'::public.app_role;
  END IF;

  -- Upsert user role (unique by user_id)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, assigned_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Resolve default organization
  SELECT id INTO v_default_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF v_default_org_id IS NULL THEN
    v_default_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Resolve default active location
  SELECT id INTO v_default_loc_id FROM public.work_locations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;

  -- Generate unique employee code
  BEGIN
    emp_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
  EXCEPTION WHEN OTHERS THEN
    emp_code := 'EMP' || to_char(now(), 'MIHH24') || floor(random() * 1000)::text;
  END;

  WHILE EXISTS (SELECT 1 FROM public.employees WHERE employee_code = emp_code) LOOP
    emp_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
  END LOOP;

  v_full_name := COALESCE(
    NULLIF(trim(new.raw_user_meta_data->>'name'), ''),
    NULLIF(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  -- Insert employee record with organization and location or update existing
  INSERT INTO public.employees (
    user_id,
    organization_id,
    work_location_id,
    employee_code,
    full_name,
    email,
    designation,
    is_superadmin,
    status
  ) VALUES (
    new.id,
    v_default_org_id,
    v_default_loc_id,
    emp_code,
    v_full_name,
    lower(trim(new.email)),
    CASE 
      WHEN v_role_text IN ('superadmin', 'super_admin') THEN 'Super Administrator'
      WHEN assigned_role = 'admin' THEN 'Administrator'
      WHEN assigned_role = 'manager' THEN 'Manager'
      ELSE 'Staff'
    END,
    (v_role_text IN ('superadmin', 'super_admin')),
    'active'
  )
  ON CONFLICT (email) DO UPDATE SET 
    user_id = EXCLUDED.user_id,
    organization_id = COALESCE(public.employees.organization_id, EXCLUDED.organization_id),
    work_location_id = COALESCE(public.employees.work_location_id, EXCLUDED.work_location_id),
    is_superadmin = (public.employees.is_superadmin OR EXCLUDED.is_superadmin),
    status = 'active';

  -- Link organization membership
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (
    v_default_org_id,
    new.id,
    CASE 
      WHEN v_role_text IN ('superadmin', 'super_admin') THEN 'super_admin'
      WHEN assigned_role = 'admin' THEN 'org_admin'
      WHEN assigned_role = 'manager' THEN 'hr_manager'
      ELSE 'employee'
    END,
    'active'
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE SET 
    role = EXCLUDED.role, 
    status = 'active';

  RETURN new;
END;
$$;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Enhance superadmin_provision_user to always maintain auth.identities
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
  v_org_id uuid;
  v_work_loc_id uuid;
  v_clean_email text;
  v_hash text;
BEGIN
  v_clean_email := lower(trim(p_email));

  -- Resolve role mappings
  IF p_role IN ('superadmin', 'super_admin') THEN
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

  -- Resolve default organization
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF v_org_id IS NULL THEN
    v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Resolve default active work location
  SELECT id INTO v_work_loc_id FROM public.work_locations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;

  -- Check existing user in auth.users
  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = v_clean_email;

  IF v_existing_id IS NOT NULL THEN
    v_user_id := v_existing_id;

    IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
      v_hash := extensions.crypt(trim(p_password), extensions.gen_salt('bf', 10));
      UPDATE auth.users
      SET encrypted_password = v_hash,
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', p_role),
          raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', trim(p_full_name)),
          updated_at = now()
      WHERE id = v_user_id;
    ELSE
      UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', p_role),
          raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', trim(p_full_name)),
          updated_at = now()
      WHERE id = v_user_id;
    END IF;

    -- Ensure auth.identities exists (omit generated column email)
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
      jsonb_build_object('sub', v_user_id, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = now();

    -- Strict role assignment
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, v_role)
    ON CONFLICT (user_id) DO UPDATE SET role = v_role;

    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_org_id, v_user_id, v_org_role, 'active')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = v_org_role, status = 'active';

    -- Connect employee
    UPDATE public.employees
    SET full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
        department_id = COALESCE(p_department_id, department_id),
        designation = COALESCE(NULLIF(trim(p_designation), ''), designation),
        phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
        organization_id = COALESCE(organization_id, v_org_id),
        work_location_id = COALESCE(work_location_id, v_work_loc_id),
        is_superadmin = (is_superadmin OR v_is_super),
        status = 'active',
        user_id = v_user_id
    WHERE user_id = v_user_id OR lower(email) = v_clean_email
    RETURNING id INTO v_emp_id;

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_user_id,
      'employee_id', v_emp_id,
      'email', v_clean_email,
      'role', p_role,
      'is_superadmin', v_is_super,
      'status', 'updated'
    );
  END IF;

  -- Create new auth user
  v_user_id := gen_random_uuid();
  v_hash := extensions.crypt(trim(p_password), extensions.gen_salt('bf', 10));

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_clean_email,
    v_hash,
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', p_role),
    jsonb_build_object('name', trim(p_full_name), 'sub', v_user_id),
    now(),
    now()
  );

  -- Create identity (omit generated column email)
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
    jsonb_build_object('sub', v_user_id, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  -- Single role assignment
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, v_role)
  ON CONFLICT (user_id) DO UPDATE SET role = v_role;

  -- Organization membership
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_org_id, v_user_id, v_org_role, 'active')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = v_org_role, status = 'active';

  -- Update employee created by handle_new_user trigger or existing by email
  UPDATE public.employees
  SET full_name = trim(p_full_name),
      department_id = p_department_id,
      designation = COALESCE(NULLIF(trim(p_designation), ''), CASE WHEN v_is_super THEN 'Super Administrator' WHEN v_role = 'admin' THEN 'Administrator' ELSE 'Staff' END),
      phone = NULLIF(trim(p_phone), ''),
      organization_id = v_org_id,
      work_location_id = v_work_loc_id,
      is_superadmin = v_is_super,
      status = 'active',
      user_id = v_user_id
  WHERE user_id = v_user_id OR lower(email) = v_clean_email
  RETURNING id INTO v_emp_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'employee_id', v_emp_id,
    'email', v_clean_email,
    'role', p_role,
    'is_superadmin', v_is_super,
    'status', 'created'
  );
END;
$$;

-- 4. Ensure system_secrets has complete RLS policy
ALTER TABLE public.system_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmins_manage_system_secrets" ON public.system_secrets;
CREATE POLICY "superadmins_manage_system_secrets" ON public.system_secrets
FOR ALL TO authenticated
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- 5. Set search_path on auth helper functions
ALTER FUNCTION public.handle_new_user() SET search_path = public, auth, extensions;
ALTER FUNCTION public.superadmin_provision_user(text, text, text, text, uuid, text, text) SET search_path = public, auth, extensions;
ALTER FUNCTION public.admin_create_employee_v2(text, text, text, text, text, text, text, uuid, date, text, text, uuid, text, text, date, text, text, text, text, text, text, text) SET search_path = public, auth, extensions;
