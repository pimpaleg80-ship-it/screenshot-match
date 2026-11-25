-- 20261124110000_phase01_employee_management_and_self_service.sql
-- FLOWPEOPLE PHASE 01: Employee Management + Employee Self-Service
-- Additive migration: schemas, tables, relationships, helper functions, and RLS policies.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Helper function: get_current_employee_id
CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_employee_id() TO authenticated;

-- 2. Shifts Table (Pre-requisite for employees.shift_id)
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  start_time time NOT NULL DEFAULT '09:00:00',
  end_time time NOT NULL DEFAULT '18:00:00',
  work_days text[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  organization_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Ensure additive columns exist if table was already created
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS work_days text[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

-- Seed default shifts if none exist
INSERT INTO public.shifts (name, code, start_time, end_time, work_days, organization_id)
SELECT 'General Day Shift (9 AM - 6 PM)', 'SH-GEN', '09:00:00', '18:00:00', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.shifts WHERE code = 'SH-GEN');

INSERT INTO public.shifts (name, code, start_time, end_time, work_days, organization_id)
SELECT 'Morning Shift (6 AM - 3 PM)', 'SH-MORN', '06:00:00', '15:00:00', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.shifts WHERE code = 'SH-MORN');

INSERT INTO public.shifts (name, code, start_time, end_time, work_days, organization_id)
SELECT 'Night Shift (10 PM - 7 AM)', 'SH-NIGHT', '22:00:00', '07:00:00', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.shifts WHERE code = 'SH-NIGHT');

-- 3. Extend public.employees with Phase 01 fields
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS personal_email text,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS marital_status text,
ADD COLUMN IF NOT EXISTS blood_group text,
ADD COLUMN IF NOT EXISTS nationality text DEFAULT 'Indian',
ADD COLUMN IF NOT EXISTS current_address text,
ADD COLUMN IF NOT EXISTS permanent_address text,
ADD COLUMN IF NOT EXISTS emergency_contact_name text,
ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
ADD COLUMN IF NOT EXISTS emergency_contact_relation text,
ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'full_time',
ADD COLUMN IF NOT EXISTS work_location text DEFAULT 'onsite',
ADD COLUMN IF NOT EXISTS probation_end_date date,
ADD COLUMN IF NOT EXISTS notice_period_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS organization_id uuid,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Indices on public.employees
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON public.employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_shift_id ON public.employees(shift_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_organization_id ON public.employees(organization_id);

-- 4. Extend public.documents
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS organization_id uuid,
ADD COLUMN IF NOT EXISTS file_name text,
ADD COLUMN IF NOT EXISTS file_size bigint,
ADD COLUMN IF NOT EXISTS file_type text,
ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'General',
ADD COLUMN IF NOT EXISTS uploaded_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON public.documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON public.documents(organization_id);

-- 5. Expense Claims Table
CREATE TABLE IF NOT EXISTS public.expense_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_claims_employee_id ON public.expense_claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON public.expense_claims(status);

-- 6. HR Tickets Table
CREATE SEQUENCE IF NOT EXISTS public.hr_ticket_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS public.hr_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE DEFAULT ('TICK-' || nextval('public.hr_ticket_seq')::text),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  priority text NOT NULL DEFAULT 'medium',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_tickets_employee_id ON public.hr_tickets(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_tickets_status ON public.hr_tickets(status);

-- 7. Performance Reviews Table
CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid,
  reviewer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  review_period text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  goals text,
  feedback text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee_id ON public.performance_reviews(employee_id);

-- 8. Payslips Table
CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  allowances numeric(12,2) NOT NULL DEFAULT 0,
  deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  pdf_url text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payslips_employee_id ON public.payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_year_month ON public.payslips(year, month);

-- 9. Employee Profile History Table
CREATE TABLE IF NOT EXISTS public.employee_profile_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  changes jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_profile_history_employee_id ON public.employee_profile_history(employee_id);

-- 10. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profile_history ENABLE ROW LEVEL SECURITY;

-- 11. Shifts RLS Policies
DROP POLICY IF EXISTS "shifts_view_authenticated" ON public.shifts;
CREATE POLICY "shifts_view_authenticated" ON public.shifts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shifts_admin_all" ON public.shifts;
CREATE POLICY "shifts_admin_all" ON public.shifts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- 12. Documents RLS Policies
DROP POLICY IF EXISTS "documents_admin_all" ON public.documents;
CREATE POLICY "documents_admin_all" ON public.documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "documents_employee_select" ON public.documents;
CREATE POLICY "documents_employee_select" ON public.documents
  FOR SELECT TO authenticated
  USING (
    employee_id IS NULL OR 
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "documents_employee_insert" ON public.documents;
CREATE POLICY "documents_employee_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.is_superadmin(auth.uid())
  );

-- 13. Expense Claims RLS Policies
DROP POLICY IF EXISTS "expenses_admin_all" ON public.expense_claims;
CREATE POLICY "expenses_admin_all" ON public.expense_claims
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "expenses_employee_select" ON public.expense_claims;
CREATE POLICY "expenses_employee_select" ON public.expense_claims
  FOR SELECT TO authenticated
  USING (
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "expenses_employee_insert" ON public.expense_claims;
CREATE POLICY "expenses_employee_insert" ON public.expense_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.is_superadmin(auth.uid())
  );

-- 14. HR Tickets RLS Policies
DROP POLICY IF EXISTS "hr_tickets_admin_all" ON public.hr_tickets;
CREATE POLICY "hr_tickets_admin_all" ON public.hr_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "hr_tickets_employee_select" ON public.hr_tickets;
CREATE POLICY "hr_tickets_employee_select" ON public.hr_tickets
  FOR SELECT TO authenticated
  USING (
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "hr_tickets_employee_insert" ON public.hr_tickets;
CREATE POLICY "hr_tickets_employee_insert" ON public.hr_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.is_superadmin(auth.uid())
  );

-- 15. Performance Reviews RLS Policies
DROP POLICY IF EXISTS "performance_admin_all" ON public.performance_reviews;
CREATE POLICY "performance_admin_all" ON public.performance_reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "performance_employee_select" ON public.performance_reviews;
CREATE POLICY "performance_employee_select" ON public.performance_reviews
  FOR SELECT TO authenticated
  USING (
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.is_superadmin(auth.uid())
  );

-- 16. Payslips RLS Policies
DROP POLICY IF EXISTS "payslips_admin_all" ON public.payslips;
CREATE POLICY "payslips_admin_all" ON public.payslips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "payslips_employee_select" ON public.payslips;
CREATE POLICY "payslips_employee_select" ON public.payslips
  FOR SELECT TO authenticated
  USING (
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.is_superadmin(auth.uid())
  );

-- 17. Employee Profile History RLS Policies
DROP POLICY IF EXISTS "profile_history_admin_all" ON public.employee_profile_history;
CREATE POLICY "profile_history_admin_all" ON public.employee_profile_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "profile_history_employee_select" ON public.employee_profile_history;
CREATE POLICY "profile_history_employee_select" ON public.employee_profile_history
  FOR SELECT TO authenticated
  USING (
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.is_superadmin(auth.uid())
  );

-- 17b. Employee Self-Update & Admin Update Policies
DROP POLICY IF EXISTS "employees_self_update" ON public.employees;
CREATE POLICY "employees_self_update" ON public.employees
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "employees_admin_update" ON public.employees;
CREATE POLICY "employees_admin_update" ON public.employees
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- 17c. Notifications Table and RLS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 17d. Holidays Read Policy
DROP POLICY IF EXISTS "holidays_read_all" ON public.holidays;
CREATE POLICY "holidays_read_all" ON public.holidays
  FOR SELECT TO authenticated USING (true);

-- 17e. Profile update audit trigger
CREATE OR REPLACE FUNCTION public.log_employee_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.employee_profile_history (
    employee_id,
    changed_by,
    action,
    changes
  ) VALUES (
    NEW.id,
    auth.uid(),
    'PROFILE_UPDATED',
    jsonb_build_object(
      'phone', NEW.phone,
      'personal_email', NEW.personal_email,
      'current_address', NEW.current_address,
      'emergency_contact_name', NEW.emergency_contact_name,
      'emergency_contact_phone', NEW.emergency_contact_phone,
      'emergency_contact_relation', NEW.emergency_contact_relation
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_profile_audit ON public.employees;
CREATE TRIGGER trg_employee_profile_audit
AFTER UPDATE OF phone, personal_email, current_address, emergency_contact_name, emergency_contact_phone, emergency_contact_relation
ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.log_employee_profile_update();

-- 18. Update public.people VIEW to reflect all new fields safely
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
  e.created_at,
  e.user_id,
  e.department_id,
  e.designation,
  e.personal_email,
  e.gender,
  e.date_of_birth,
  e.marital_status,
  e.blood_group,
  e.nationality,
  e.current_address,
  e.permanent_address,
  e.emergency_contact_name,
  e.emergency_contact_phone,
  e.emergency_contact_relation,
  e.employment_type,
  e.work_location,
  e.joining_date,
  e.probation_end_date,
  e.notice_period_days,
  e.shift_id,
  s.name AS shift_name,
  e.manager_id,
  m.full_name AS manager_name,
  e.status,
  e.organization_id,
  e.updated_at
FROM public.employees e
LEFT JOIN public.departments d ON d.id = e.department_id
LEFT JOIN public.shifts s ON s.id = e.shift_id
LEFT JOIN public.employees m ON m.id = e.manager_id
WHERE e.is_superadmin IS NOT TRUE;

-- 19. Enhanced admin_create_employee RPC supporting full Phase 01 fields
CREATE OR REPLACE FUNCTION public.admin_create_employee_v2(
  p_email text,
  p_password text,
  p_full_name text,
  p_department text DEFAULT 'General',
  p_designation text DEFAULT 'Employee',
  p_phone text DEFAULT NULL,
  p_person_code text DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL,
  p_joining_date date DEFAULT CURRENT_DATE,
  p_employment_type text DEFAULT 'full_time',
  p_work_location text DEFAULT 'onsite',
  p_shift_id uuid DEFAULT NULL,
  p_personal_email text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_blood_group text DEFAULT NULL,
  p_marital_status text DEFAULT NULL,
  p_current_address text DEFAULT NULL,
  p_permanent_address text DEFAULT NULL,
  p_emergency_contact_name text DEFAULT NULL,
  p_emergency_contact_phone text DEFAULT NULL,
  p_emergency_contact_relation text DEFAULT NULL
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
    RAISE EXCEPTION 'Access denied. Only administrators can register employees.';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required for employee account.';
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

  -- Assign 'employee' role
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'employee');

  -- Update employee if created by auth.users trigger, else insert
  UPDATE public.employees
  SET full_name = trim(p_full_name),
      department_id = v_dept_id,
      designation = COALESCE(NULLIF(trim(p_designation), ''), 'Employee'),
      phone = NULLIF(trim(p_phone), ''),
      employee_code = v_code,
      manager_id = p_manager_id,
      joining_date = COALESCE(p_joining_date, CURRENT_DATE),
      employment_type = COALESCE(p_employment_type, 'full_time'),
      work_location = COALESCE(p_work_location, 'onsite'),
      shift_id = p_shift_id,
      personal_email = NULLIF(trim(p_personal_email), ''),
      gender = p_gender,
      date_of_birth = p_date_of_birth,
      blood_group = p_blood_group,
      marital_status = p_marital_status,
      current_address = p_current_address,
      permanent_address = p_permanent_address,
      emergency_contact_name = p_emergency_contact_name,
      emergency_contact_phone = p_emergency_contact_phone,
      emergency_contact_relation = p_emergency_contact_relation,
      is_superadmin = false,
      status = 'active',
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING id, employee_code INTO v_emp_id, v_code;

  IF v_emp_id IS NULL THEN
    INSERT INTO public.employees (
      user_id,
      employee_code,
      full_name,
      email,
      phone,
      department_id,
      designation,
      manager_id,
      joining_date,
      employment_type,
      work_location,
      shift_id,
      personal_email,
      gender,
      date_of_birth,
      blood_group,
      marital_status,
      current_address,
      permanent_address,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relation,
      is_superadmin,
      status
    ) VALUES (
      v_user_id,
      v_code,
      trim(p_full_name),
      lower(trim(p_email)),
      NULLIF(trim(p_phone), ''),
      v_dept_id,
      COALESCE(NULLIF(trim(p_designation), ''), 'Employee'),
      p_manager_id,
      COALESCE(p_joining_date, CURRENT_DATE),
      COALESCE(p_employment_type, 'full_time'),
      COALESCE(p_work_location, 'onsite'),
      p_shift_id,
      NULLIF(trim(p_personal_email), ''),
      p_gender,
      p_date_of_birth,
      p_blood_group,
      p_marital_status,
      p_current_address,
      p_permanent_address,
      p_emergency_contact_name,
      p_emergency_contact_phone,
      p_emergency_contact_relation,
      false,
      'active'
    )
    RETURNING id, employee_code INTO v_emp_id, v_code;
  END IF;

  -- Log in profile history
  INSERT INTO public.employee_profile_history (employee_id, changed_by, action, changes)
  VALUES (
    v_emp_id,
    auth.uid(),
    'REGISTERED',
    jsonb_build_object(
      'full_name', p_full_name,
      'email', p_email,
      'employee_code', v_code,
      'department', p_department,
      'designation', p_designation
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'employee_id', v_emp_id,
    'employee_code', v_code,
    'email', lower(trim(p_email))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_employee_v2 TO authenticated;
