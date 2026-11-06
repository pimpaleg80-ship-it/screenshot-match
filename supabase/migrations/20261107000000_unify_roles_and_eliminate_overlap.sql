-- 20261107000000_unify_roles_and_eliminate_overlap.sql
-- Eliminate role overlapping between superadmin, admin, and employee across database, auth metadata, and RLS

-- 1. Deduplicate user_roles table so each user has strictly ONE primary role
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.user_id = b.user_id 
  AND a.ctid < b.ctid;

-- Drop existing composite unique constraint if exists and enforce single role per user
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- 2. Cleanly synchronize all existing user accounts
-- Superadmins: pimpaleharshad99@gmail.com, pimpaleg80@gmail.com
-- Admins: hp@gmail.com
-- Employees: ha@gmail.com, hpp@gmail.com, h@gmail.com

-- Superadmin 1: pimpaleharshad99@gmail.com
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'pimpaleharshad99@gmail.com';
  IF v_uid IS NOT NULL THEN
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "superadmin"}'::jsonb
    WHERE id = v_uid;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

    UPDATE public.organization_members SET role = 'super_admin' WHERE user_id = v_uid;
    UPDATE public.employees SET is_superadmin = true, designation = 'Root Super Administrator' WHERE user_id = v_uid;
  END IF;
END $$;

-- Superadmin 2: pimpaleg80@gmail.com
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'pimpaleg80@gmail.com';
  IF v_uid IS NOT NULL THEN
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "superadmin"}'::jsonb
    WHERE id = v_uid;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

    UPDATE public.organization_members SET role = 'super_admin' WHERE user_id = v_uid;
    UPDATE public.employees SET is_superadmin = true, designation = 'Super Administrator' WHERE user_id = v_uid;
  END IF;
END $$;

-- Company Admin: hp@gmail.com
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'hp@gmail.com';
  IF v_uid IS NOT NULL THEN
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = v_uid;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

    UPDATE public.organization_members SET role = 'org_admin' WHERE user_id = v_uid;
    UPDATE public.employees SET is_superadmin = false, designation = 'Administrator' WHERE user_id = v_uid;
  END IF;
END $$;

-- Employee 1: ha@gmail.com
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'ha@gmail.com';
  IF v_uid IS NOT NULL THEN
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "employee"}'::jsonb
    WHERE id = v_uid;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'employee')
    ON CONFLICT (user_id) DO UPDATE SET role = 'employee';

    UPDATE public.organization_members SET role = 'employee' WHERE user_id = v_uid;
    UPDATE public.employees SET is_superadmin = false, designation = 'Staff' WHERE user_id = v_uid;
  END IF;
END $$;

-- Employee 2: hpp@gmail.com
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'hpp@gmail.com';
  IF v_uid IS NOT NULL THEN
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "employee"}'::jsonb
    WHERE id = v_uid;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'employee')
    ON CONFLICT (user_id) DO UPDATE SET role = 'employee';

    UPDATE public.organization_members SET role = 'employee' WHERE user_id = v_uid;
    UPDATE public.employees SET is_superadmin = false, designation = 'Staff' WHERE user_id = v_uid;
  END IF;
END $$;

-- Employee 3: h@gmail.com
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'h@gmail.com';
  IF v_uid IS NOT NULL THEN
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "employee"}'::jsonb
    WHERE id = v_uid;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'employee')
    ON CONFLICT (user_id) DO UPDATE SET role = 'employee';

    UPDATE public.organization_members SET role = 'employee' WHERE user_id = v_uid;
    UPDATE public.employees SET is_superadmin = false, designation = 'Staff' WHERE user_id = v_uid;
  END IF;
END $$;

-- 3. Upgrade superadmin_set_user_role to update auth, user_roles, organization_members, and employees atomically
CREATE OR REPLACE FUNCTION public.superadmin_set_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_app_role public.app_role;
  v_org_role text;
  v_is_super boolean := false;
  v_default_desig text;
BEGIN
  IF p_new_role = 'superadmin' THEN
    v_app_role := 'admin'::public.app_role;
    v_org_role := 'super_admin';
    v_is_super := true;
    v_default_desig := 'Super Administrator';
  ELSIF p_new_role = 'admin' THEN
    v_app_role := 'admin'::public.app_role;
    v_org_role := 'org_admin';
    v_is_super := false;
    v_default_desig := 'Administrator';
  ELSIF p_new_role = 'manager' THEN
    v_app_role := 'manager'::public.app_role;
    v_org_role := 'hr_manager';
    v_is_super := false;
    v_default_desig := 'Manager';
  ELSIF p_new_role = 'employee' THEN
    v_app_role := 'employee'::public.app_role;
    v_org_role := 'employee';
    v_is_super := false;
    v_default_desig := 'Staff';
  ELSE
    RAISE EXCEPTION 'Invalid role: %. Must be superadmin, admin, manager, or employee.', p_new_role;
  END IF;

  -- 1. Sync user_roles (strictly 1 role per user)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_target_user_id, v_app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = v_app_role;

  -- 2. Sync organization_members
  UPDATE public.organization_members
  SET role = v_org_role
  WHERE user_id = p_target_user_id;

  -- 3. Sync employees profile
  UPDATE public.employees
  SET is_superadmin = v_is_super,
      designation = COALESCE(designation, v_default_desig)
  WHERE user_id = p_target_user_id;

  -- 4. Sync auth.users metadata
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_new_role)
  WHERE id = p_target_user_id;

  -- 5. Audit Log
  INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'SUPERADMIN_ROLE_CHANGE',
    jsonb_build_object(
      'target_user_id', p_target_user_id, 
      'new_role', p_new_role, 
      'app_role', v_app_role,
      'org_role', v_org_role,
      'is_superadmin', v_is_super
    ),
    p_target_user_id
  );

  RETURN jsonb_build_object(
    'success', true, 
    'new_role', p_new_role, 
    'org_role', v_org_role,
    'is_superadmin', v_is_super
  );
END;
$$;

-- 4. Upgrade superadmin_provision_user to ensure clean single-role assignment
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

  -- Resolve default organization
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF v_org_id IS NULL THEN
    v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Resolve default active work location
  SELECT id INTO v_work_loc_id FROM public.work_locations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;

  -- Check existing user
  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = lower(trim(p_email));

  IF v_existing_id IS NOT NULL THEN
    v_user_id := v_existing_id;

    IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(trim(p_password), extensions.gen_salt('bf', 10)),
          raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role),
          updated_at = now()
      WHERE id = v_user_id;
    ELSE
      UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role),
          updated_at = now()
      WHERE id = v_user_id;
    END IF;

    -- Strict single role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, v_role)
    ON CONFLICT (user_id) DO UPDATE SET role = v_role;

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

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_user_id,
      'employee_id', v_emp_id,
      'email', trim(p_email),
      'role', p_role,
      'is_superadmin', v_is_super,
      'status', 'updated'
    );
  END IF;

  -- Create new auth user
  v_user_id := gen_random_uuid();
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
    lower(trim(p_email)),
    extensions.crypt(trim(p_password), extensions.gen_salt('bf', 10)),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', p_role),
    jsonb_build_object('name', trim(p_full_name)),
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

  -- Update employee created by handle_new_user trigger
  UPDATE public.employees
  SET full_name = trim(p_full_name),
      department_id = p_department_id,
      designation = COALESCE(NULLIF(trim(p_designation), ''), CASE WHEN v_is_super THEN 'Super Administrator' WHEN v_role = 'admin' THEN 'Administrator' ELSE 'Staff' END),
      phone = NULLIF(trim(p_phone), ''),
      organization_id = v_org_id,
      work_location_id = v_work_loc_id,
      is_superadmin = v_is_super,
      status = 'active'
  WHERE user_id = v_user_id
  RETURNING id INTO v_emp_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'employee_id', v_emp_id,
    'email', trim(p_email),
    'role', p_role,
    'is_superadmin', v_is_super,
    'status', 'created'
  );
END;
$$;

-- 5. Strict role-checking functions for security and RLS
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.user_id = (select auth.uid()) AND e.is_superadmin = true
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (select auth.uid()) AND om.role IN ('super_admin', 'org_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.user_id = (select auth.uid()) AND e.is_superadmin = true
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (select auth.uid()) AND om.role = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_provision_user(text, text, text, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_superadmin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, anon;

