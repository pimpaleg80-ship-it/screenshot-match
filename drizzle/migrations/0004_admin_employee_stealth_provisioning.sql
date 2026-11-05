-- 0004_admin_employee_stealth_provisioning.sql
-- Dedicated Admin employee provisioning with Auth and stealth view for superadmin separation

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
  SELECT id INTO v_existing_id FROM auth.users WHERE email = lower(trim(p_email));
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'An account with email % already exists.', lower(trim(p_email));
  END IF;

  -- Department resolution
  IF p_department IS NOT NULL AND trim(p_department) <> '' THEN
    SELECT id INTO v_dept_id FROM public.departments WHERE lower(name) = lower(trim(p_department)) LIMIT 1;
    IF v_dept_id IS NULL THEN
      INSERT INTO public.departments (name) VALUES (trim(p_department)) RETURNING id INTO v_dept_id;
    END IF;
  END IF;

  -- Create Auth User
  v_user_id := gen_random_uuid();
  v_hash := crypt(trim(p_password), gen_salt('bf', 10));

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

  -- Update the employee record created by handle_new_user trigger
  UPDATE public.employees
  SET full_name = trim(p_full_name),
      department_id = v_dept_id,
      phone = NULLIF(trim(p_phone), ''),
      employee_code = COALESCE(NULLIF(trim(p_person_code), ''), employee_code),
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
      COALESCE(NULLIF(trim(p_person_code), ''), 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0')),
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

  -- Create initial leave balances for employee if leave_types exist
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total, used)
  SELECT v_emp_id, id, EXTRACT(YEAR FROM CURRENT_DATE)::integer, days_per_year, 0
  FROM public.leave_types
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'employee_id', v_emp_id,
    'user_id', v_user_id,
    'employee_code', v_code,
    'email', lower(trim(p_email)),
    'full_name', trim(p_full_name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_employee(text, text, text, text, text, text) TO authenticated;

-- Ensure people view never leaks superadmin
CREATE OR REPLACE VIEW public.people AS
SELECT 
  e.id,
  e.full_name AS name,
  e.employee_code AS person_code,
  COALESCE(d.name, 'General'::text) AS department,
  e.email,
  e.phone,
  true AS consent,
  (e.status = 'active'::text) AS active,
  e.photo_url,
  e.created_at
FROM public.employees e
LEFT JOIN public.departments d ON d.id = e.department_id
WHERE e.is_superadmin IS NOT TRUE;
