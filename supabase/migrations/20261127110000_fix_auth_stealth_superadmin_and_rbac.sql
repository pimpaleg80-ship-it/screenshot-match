-- Fix GoTrue auth token nulls, enforce strict Root Superadmin stealth & control,
-- harden superadmin_* / admin_create_* RPCs, and implement hierarchical access provisioning:
--   Root Superadmin -> controls system/orgs + Admins (hidden from orgs)
--   Org Admin       -> grants access to Managers & Employees in their org
--   Manager         -> grants access to Employees only in their org/team

-- ============================================================================
-- 1. Repair GoTrue auth.users NULL string token fields & missing metadata
-- ============================================================================
UPDATE auth.users
SET
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
  raw_user_meta_data          = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'sub', id::text,
    'email', lower(email),
    'email_verified', true,
    'phone_verified', false
  )
WHERE
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change_token_new IS NULL
  OR email_change IS NULL
  OR email_change_token_current IS NULL
  OR phone_change IS NULL
  OR phone_change_token IS NULL
  OR reauthentication_token IS NULL
  OR email_change_confirm_status IS NULL
  OR is_sso_user IS NULL
  OR is_anonymous IS NULL
  OR NOT (raw_user_meta_data ? 'email_verified');

-- Ensure email identity exists for every email user
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
SELECT
  u.id,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', lower(u.email),
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  u.id::text,
  COALESCE(u.last_sign_in_at, u.created_at, now()),
  COALESCE(u.created_at, now()),
  now()
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ============================================================================
-- 2. Consistent Security Helpers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = _user_id AND e.is_superadmin = true
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = _user_id
        AND om.status = 'active'
        AND om.role = 'super_admin'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_superadmin((SELECT auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.current_employee_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT e.organization_id FROM public.employees e WHERE e.user_id = (SELECT auth.uid()) LIMIT 1),
    (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = (SELECT auth.uid()) AND om.status = 'active' ORDER BY om.created_at ASC LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_employee_dept_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.department_id
  FROM public.employees e
  WHERE e.user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

-- Strict Admin check (excludes hr_manager / manager)
CREATE OR REPLACE FUNCTION public.is_org_strict_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND (
      public.is_superadmin((SELECT auth.uid()))
      OR (
        p_org_id IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.user_id = (SELECT auth.uid())
              AND om.organization_id = p_org_id
              AND om.status = 'active'
              AND om.role IN ('super_admin', 'org_admin')
          )
          OR (
            EXISTS (
              SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = (SELECT auth.uid())
                AND ur.role = 'admin'::public.app_role
            )
            AND EXISTS (
              SELECT 1 FROM public.employees e
              WHERE e.user_id = (SELECT auth.uid())
                AND e.organization_id = p_org_id
            )
          )
        )
      )
    );
$$;

-- ============================================================================
-- 3. Protect Root Superadmin Flag & Update Stealth RLS Policies
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_employee_superadmin_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
BEGIN
  -- Enforce only for API requests (authenticated / anon), allow postgres/service_role migrations & RPC checks
  IF v_jwt_role IN ('authenticated', 'anon') AND NOT public.is_superadmin((SELECT auth.uid())) THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.is_superadmin IS TRUE THEN
        RAISE EXCEPTION 'Forbidden: Only Root Superadmin can assign superadmin privileges.'
          USING ERRCODE = '42501';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.is_superadmin IS TRUE OR (NEW.is_superadmin IS DISTINCT FROM OLD.is_superadmin) THEN
        RAISE EXCEPTION 'Forbidden: Superadmin accounts and flags cannot be modified outside the Root Console.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_employee_superadmin_flag ON public.employees;
CREATE TRIGGER trg_protect_employee_superadmin_flag
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_employee_superadmin_flag();

-- employees RLS: Root superadmin hidden from ALL organization users (Admin, Manager, Employee)
DROP POLICY IF EXISTS "employees: admin all" ON public.employees;
DROP POLICY IF EXISTS "employees_admin_update" ON public.employees;
DROP POLICY IF EXISTS "employees_manage_admin_policy" ON public.employees;
DROP POLICY IF EXISTS "employees: employee select own" ON public.employees;
DROP POLICY IF EXISTS "employees: employee update phone and photo" ON public.employees;
DROP POLICY IF EXISTS "employees_self_update" ON public.employees;
DROP POLICY IF EXISTS "employees: manager insert team" ON public.employees;
DROP POLICY IF EXISTS "employees: manager select team" ON public.employees;
DROP POLICY IF EXISTS "employees: manager update team" ON public.employees;
DROP POLICY IF EXISTS "employees_select_scoped" ON public.employees;
DROP POLICY IF EXISTS "employees_insert_scoped" ON public.employees;
DROP POLICY IF EXISTS "employees_update_scoped" ON public.employees;
DROP POLICY IF EXISTS "employees_delete_scoped" ON public.employees;

CREATE POLICY "employees_select_scoped"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_superadmin((SELECT auth.uid()))
    OR (
      is_superadmin IS NOT TRUE
      AND (
        public.is_org_strict_admin(organization_id)
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND organization_id = public.current_employee_org_id()
          AND (
            public.is_my_team_member(id)
            OR (department_id IS NOT NULL AND department_id = public.current_employee_dept_id())
          )
        )
      )
    )
  );

CREATE POLICY "employees_insert_scoped"
  ON public.employees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      is_superadmin IS NOT TRUE
      AND (
        public.is_org_strict_admin(organization_id)
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND organization_id = public.current_employee_org_id()
          AND (
            manager_id = public.current_employee_id()
            OR (department_id IS NOT NULL AND department_id = public.current_employee_dept_id())
          )
        )
      )
    )
  );

CREATE POLICY "employees_update_scoped"
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR user_id = (SELECT auth.uid())
    OR (
      is_superadmin IS NOT TRUE
      AND (
        public.is_org_strict_admin(organization_id)
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND organization_id = public.current_employee_org_id()
          AND public.is_my_team_member(id)
        )
      )
    )
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      is_superadmin IS NOT TRUE
      AND (
        user_id = (SELECT auth.uid())
        OR public.is_org_strict_admin(organization_id)
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND organization_id = public.current_employee_org_id()
          AND public.is_my_team_member(id)
        )
      )
    )
  );

CREATE POLICY "employees_delete_scoped"
  ON public.employees
  FOR DELETE
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      is_superadmin IS NOT TRUE
      AND user_id IS DISTINCT FROM (SELECT auth.uid())
      AND public.is_org_strict_admin(organization_id)
    )
  );

-- user_roles RLS: hide superadmin users & restrict Org Admin writes strictly to manager/employee
DROP POLICY IF EXISTS "user_roles: admin all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles: select own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_scoped" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_superadmin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_org_admin_manage" ON public.user_roles;

CREATE POLICY "user_roles_select_scoped"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_superadmin((SELECT auth.uid()))
    OR (
      public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      AND NOT public.is_superadmin(user_id)
      AND EXISTS (
        SELECT 1 FROM public.employees te
        WHERE te.user_id = user_roles.user_id
          AND te.organization_id = public.current_employee_org_id()
      )
    )
  );

CREATE POLICY "user_roles_superadmin_all"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.is_superadmin((SELECT auth.uid())))
  WITH CHECK (public.is_superadmin((SELECT auth.uid())));

CREATE POLICY "user_roles_org_admin_manage"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    AND NOT public.is_superadmin(user_id)
    AND user_id IS DISTINCT FROM (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employees te
      WHERE te.user_id = user_roles.user_id
        AND te.organization_id = public.current_employee_org_id()
    )
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    AND NOT public.is_superadmin(user_id)
    AND user_id IS DISTINCT FROM (SELECT auth.uid())
    AND role IN ('employee'::public.app_role, 'manager'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.employees te
      WHERE te.user_id = user_roles.user_id
        AND te.organization_id = public.current_employee_org_id()
    )
  );

-- organization_members RLS: hide super_admin memberships & block org admin self/admin escalation
DROP POLICY IF EXISTS "members_admin_manage" ON public.organization_members;
DROP POLICY IF EXISTS "members_read_policy" ON public.organization_members;
DROP POLICY IF EXISTS "members_select_scoped" ON public.organization_members;
DROP POLICY IF EXISTS "members_superadmin_all" ON public.organization_members;
DROP POLICY IF EXISTS "members_org_admin_manage" ON public.organization_members;

CREATE POLICY "members_select_scoped"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_superadmin((SELECT auth.uid()))
    OR (
      role <> 'super_admin'
      AND NOT public.is_superadmin(user_id)
      AND organization_id IN (SELECT public.get_auth_user_org_ids((SELECT auth.uid())))
    )
  );

CREATE POLICY "members_superadmin_all"
  ON public.organization_members
  FOR ALL
  TO authenticated
  USING (public.is_superadmin((SELECT auth.uid())))
  WITH CHECK (public.is_superadmin((SELECT auth.uid())));

CREATE POLICY "members_org_admin_manage"
  ON public.organization_members
  FOR ALL
  TO authenticated
  USING (
    public.is_org_strict_admin(organization_id)
    AND role <> 'super_admin'
    AND NOT public.is_superadmin(user_id)
  )
  WITH CHECK (
    public.is_org_strict_admin(organization_id)
    AND role IN ('employee', 'hr_manager')
    AND NOT public.is_superadmin(user_id)
  );

-- organizations RLS: only Root Superadmin can INSERT / DELETE organizations
DROP POLICY IF EXISTS "org_admin_manage" ON public.organizations;
DROP POLICY IF EXISTS "org_read_members" ON public.organizations;
DROP POLICY IF EXISTS "org_select_scoped" ON public.organizations;
DROP POLICY IF EXISTS "org_superadmin_all" ON public.organizations;
DROP POLICY IF EXISTS "org_admin_update_own" ON public.organizations;

CREATE POLICY "org_select_scoped"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR id IN (SELECT public.get_auth_user_org_ids((SELECT auth.uid())))
  );

CREATE POLICY "org_superadmin_all"
  ON public.organizations
  FOR ALL
  TO authenticated
  USING (public.is_superadmin((SELECT auth.uid())))
  WITH CHECK (public.is_superadmin((SELECT auth.uid())));

CREATE POLICY "org_admin_update_own"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.is_org_strict_admin(id))
  WITH CHECK (public.is_org_strict_admin(id));

-- ============================================================================
-- 4. Views & Aggregate / Payroll Functions: Exclude Root Superadmin
-- ============================================================================
CREATE OR REPLACE VIEW public.work_location_stats
WITH (security_invoker = true)
AS
SELECT
  wl.id,
  wl.organization_id,
  wl.name,
  wl.address,
  wl.latitude,
  wl.longitude,
  wl.radius_meters,
  wl.is_active,
  wl.created_at,
  wl.updated_at,
  COUNT(DISTINCT e.id)::integer AS assigned_employee_count
FROM public.work_locations wl
LEFT JOIN public.employees e
  ON e.work_location_id = wl.id
 AND e.is_superadmin IS NOT TRUE
GROUP BY wl.id;

ALTER VIEW public.people SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.get_reports_analytics_overview(
  _organization_id uuid,
  _start_date date,
  _end_date date,
  _department_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := (SELECT auth.uid());
  v_headcount record;
  v_dept_dist jsonb;
  v_new_hires jsonb;
  v_attendance jsonb;
  v_leaves jsonb;
  v_shifts jsonb;
  v_recruitment jsonb;
  v_performance jsonb;
  v_expenses jsonb;
  v_payroll jsonb;
  v_tickets jsonb;
BEGIN
  IF v_caller_uid IS NULL OR NOT public.is_org_member(_organization_id) THEN
    RAISE EXCEPTION 'Forbidden: membership in organization required.'
      USING ERRCODE = '42501';
  END IF;

  -- A. Headcount Overview (excludes Root Superadmin)
  SELECT
    COUNT(*) AS total_employees,
    COUNT(*) FILTER (WHERE status = 'active') AS active_count,
    COUNT(*) FILTER (WHERE status = 'probation') AS probation_count,
    COUNT(*) FILTER (WHERE status = 'notice') AS notice_count,
    COUNT(*) FILTER (WHERE status IN ('resigned', 'relieved', 'inactive')) AS inactive_count
  INTO v_headcount
  FROM public.employees
  WHERE organization_id = _organization_id
    AND is_superadmin IS NOT TRUE
    AND (_department_id IS NULL OR department_id = _department_id);

  -- B. Department Distribution
  SELECT COALESCE(jsonb_agg(d_row), '[]'::jsonb) INTO v_dept_dist
  FROM (
    SELECT
      COALESCE(d.name, 'Unassigned') AS department,
      COUNT(e.id) AS headcount
    FROM public.employees e
    LEFT JOIN public.departments d ON d.id = e.department_id
    WHERE e.organization_id = _organization_id
      AND e.is_superadmin IS NOT TRUE
      AND e.status = 'active'
      AND (_department_id IS NULL OR e.department_id = _department_id)
    GROUP BY d.name
    ORDER BY headcount DESC
  ) d_row;

  -- C. New Hires
  SELECT COALESCE(jsonb_agg(h_row), '[]'::jsonb) INTO v_new_hires
  FROM (
    SELECT id, full_name, employee_code, designation, joining_date
    FROM public.employees
    WHERE organization_id = _organization_id
      AND is_superadmin IS NOT TRUE
      AND joining_date BETWEEN _start_date AND _end_date
      AND (_department_id IS NULL OR department_id = _department_id)
    ORDER BY joining_date DESC
  ) h_row;

  -- D. Attendance Aggregates
  SELECT COALESCE(jsonb_build_object(
    'present_count', COUNT(*) FILTER (WHERE a.status = 'present'),
    'late_count', COUNT(*) FILTER (WHERE a.status = 'late' OR a.is_late = true),
    'half_day_count', COUNT(*) FILTER (WHERE a.status = 'half_day' OR a.is_half_day = true),
    'absent_count', COUNT(*) FILTER (WHERE a.status = 'absent'),
    'leave_count', COUNT(*) FILTER (WHERE a.status = 'on_leave'),
    'total_records', COUNT(*),
    'total_overtime_hours', ROUND(COALESCE(SUM(a.overtime_hours), 0)::numeric, 1)
  ), '{}'::jsonb) INTO v_attendance
  FROM public.attendance a
  JOIN public.employees e ON e.id = a.employee_id
  WHERE a.date BETWEEN _start_date AND _end_date
    AND e.organization_id = _organization_id
    AND e.is_superadmin IS NOT TRUE
    AND (_department_id IS NULL OR e.department_id = _department_id);

  -- E. Leave Utilization
  SELECT COALESCE(jsonb_build_object(
    'casual_leave', COUNT(*) FILTER (WHERE lt.code = 'casual' OR lt.name ILIKE '%casual%'),
    'sick_leave', COUNT(*) FILTER (WHERE lt.code = 'sick' OR lt.name ILIKE '%sick%'),
    'earned_leave', COUNT(*) FILTER (WHERE lt.code = 'earned' OR lt.name ILIKE '%earned%'),
    'total_approved_days', COALESCE(SUM(l.days) FILTER (WHERE l.status = 'approved'), 0)
  ), '{}'::jsonb) INTO v_leaves
  FROM public.leave_requests l
  JOIN public.employees e ON e.id = l.employee_id
  LEFT JOIN public.leave_types lt ON lt.id = l.leave_type_id
  WHERE l.from_date BETWEEN _start_date AND _end_date
    AND e.organization_id = _organization_id
    AND e.is_superadmin IS NOT TRUE
    AND (_department_id IS NULL OR e.department_id = _department_id);

  -- F. Shift Allocations
  SELECT COALESCE(jsonb_agg(s_row), '[]'::jsonb) INTO v_shifts
  FROM (
    SELECT
      COALESCE(s.name, 'General Shift') AS shift_name,
      COUNT(a.id) AS assigned_employees
    FROM public.shifts s
    LEFT JOIN public.employee_shift_assignments a ON a.shift_id = s.id
    LEFT JOIN public.employees e ON e.id = a.employee_id AND e.is_superadmin IS NOT TRUE
    WHERE s.organization_id = _organization_id
    GROUP BY s.name
  ) s_row;

  -- G. Recruitment Pipeline
  SELECT COALESCE(jsonb_build_object(
    'applied', COUNT(*) FILTER (WHERE c.stage = 'applied'),
    'screening', COUNT(*) FILTER (WHERE c.stage = 'screening'),
    'shortlisted', COUNT(*) FILTER (WHERE c.stage = 'shortlisted'),
    'interview', COUNT(*) FILTER (WHERE c.stage = 'interview'),
    'selected', COUNT(*) FILTER (WHERE c.stage = 'selected'),
    'offer', COUNT(*) FILTER (WHERE c.stage = 'offer'),
    'hired', COUNT(*) FILTER (WHERE c.stage = 'hired'),
    'rejected', COUNT(*) FILTER (WHERE c.stage = 'rejected')
  ), '{}'::jsonb) INTO v_recruitment
  FROM public.candidates c
  WHERE c.organization_id = _organization_id;

  -- H. Expenses Summary
  SELECT COALESCE(jsonb_build_object(
    'total_amount', COALESCE(SUM(c.amount), 0),
    'approved_amount', COALESCE(SUM(c.amount) FILTER (WHERE c.status IN ('approved', 'reimbursed')), 0),
    'travel_amount', COALESCE(SUM(c.amount) FILTER (WHERE c.category = 'Travel expenses'), 0),
    'food_amount', COALESCE(SUM(c.amount) FILTER (WHERE c.category = 'Food expenses'), 0),
    'claims_count', COUNT(*)
  ), '{}'::jsonb) INTO v_expenses
  FROM public.expense_claims c
  JOIN public.employees e ON e.id = c.employee_id
  WHERE c.expense_date BETWEEN _start_date AND _end_date
    AND e.organization_id = _organization_id
    AND e.is_superadmin IS NOT TRUE
    AND (_department_id IS NULL OR e.department_id = _department_id);

  -- I. Payroll Summaries
  SELECT COALESCE(jsonb_build_object(
    'total_gross', COALESCE(SUM(total_gross), 0),
    'total_net', COALESCE(SUM(total_net), 0),
    'total_pf', COALESCE(SUM(total_pf_employee + total_pf_employer), 0),
    'total_pt', COALESCE(SUM(total_pt), 0),
    'total_tds', COALESCE(SUM(total_tds), 0),
    'runs_count', COUNT(*)
  ), '{}'::jsonb) INTO v_payroll
  FROM public.payroll_runs
  WHERE organization_id = _organization_id
    AND created_at BETWEEN _start_date AND _end_date;

  -- J. HR Ticket Statistics
  SELECT COALESCE(jsonb_build_object(
    'total_tickets', COUNT(*),
    'open_tickets', COUNT(*) FILTER (WHERE t.status IN ('open', 'assigned', 'in_progress')),
    'resolved_tickets', COUNT(*) FILTER (WHERE t.status IN ('resolved', 'closed')),
    'attendance_queries', COUNT(*) FILTER (WHERE t.category = 'Attendance complaints'),
    'leave_queries', COUNT(*) FILTER (WHERE t.category = 'Leave queries'),
    'payroll_queries', COUNT(*) FILTER (WHERE t.category = 'Payroll queries')
  ), '{}'::jsonb) INTO v_tickets
  FROM public.hr_tickets t
  JOIN public.employees e ON e.id = t.employee_id
  WHERE t.created_at BETWEEN _start_date AND _end_date
    AND e.organization_id = _organization_id
    AND e.is_superadmin IS NOT TRUE
    AND (_department_id IS NULL OR e.department_id = _department_id);

  -- K. Performance Summaries
  SELECT COALESCE(jsonb_build_object(
    'total_reviews', COUNT(*),
    'completed_reviews', COUNT(*) FILTER (WHERE status = 'completed'),
    'avg_rating', ROUND(COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL), 0)::numeric, 1)
  ), '{}'::jsonb) INTO v_performance
  FROM public.performance_reviews
  WHERE organization_id = _organization_id;

  RETURN jsonb_build_object(
    'headcount', to_jsonb(v_headcount),
    'department_distribution', v_dept_dist,
    'new_hires', v_new_hires,
    'attendance', v_attendance,
    'leaves', v_leaves,
    'shifts', v_shifts,
    'recruitment', v_recruitment,
    'expenses', v_expenses,
    'payroll', v_payroll,
    'tickets', v_tickets,
    'performance', v_performance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_monthly_payroll_run(
  _organization_id uuid,
  _year integer,
  _month integer,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run_id uuid;
  v_settings public.payroll_settings%ROWTYPE;
  v_emp RECORD;
  v_struct RECORD;
  v_working_days integer;
  v_present_days numeric(5,2);
  v_unpaid_leave_days numeric(5,2);
  v_lop_days numeric(5,2);
  v_overtime_hours numeric(6,2);
  v_basic numeric(12,2);
  v_hra numeric(12,2);
  v_special numeric(12,2);
  v_conveyance numeric(12,2);
  v_medical numeric(12,2);
  v_other_allowances numeric(12,2);
  v_overtime_pay numeric(12,2);
  v_gross numeric(12,2);
  v_pf_emp numeric(12,2);
  v_pf_empr numeric(12,2);
  v_esi_emp numeric(12,2);
  v_esi_empr numeric(12,2);
  v_pt numeric(12,2);
  v_tds numeric(12,2);
  v_lop_deduction numeric(12,2);
  v_total_deductions numeric(12,2);
  v_net numeric(12,2);
  v_start_date date;
  v_end_date date;
  v_month_name text;

  v_tot_employees integer := 0;
  v_tot_gross numeric(14,2) := 0;
  v_tot_deductions numeric(14,2) := 0;
  v_tot_net numeric(14,2) := 0;
  v_tot_pf_emp numeric(14,2) := 0;
  v_tot_pf_empr numeric(14,2) := 0;
  v_tot_esi_emp numeric(14,2) := 0;
  v_tot_esi_empr numeric(14,2) := 0;
  v_tot_pt numeric(14,2) := 0;
  v_tot_tds numeric(14,2) := 0;
  v_tot_lop numeric(14,2) := 0;
  v_caller_uid uuid := (SELECT auth.uid());
  v_jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
BEGIN
  IF v_jwt_role = 'anon' OR (v_jwt_role = 'authenticated' AND v_caller_uid IS NULL) THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_uid IS NOT NULL AND NOT public.is_org_admin(_organization_id) THEN
    RAISE EXCEPTION 'Forbidden: only HR/Admin users can process payroll.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_settings FROM public.payroll_settings
  WHERE organization_id = _organization_id;

  IF NOT FOUND THEN
    INSERT INTO public.payroll_settings (organization_id)
    VALUES (_organization_id)
    RETURNING * INTO v_settings;
  END IF;

  v_start_date := make_date(_year, _month, 1);
  v_end_date := (v_start_date + interval '1 month - 1 day')::date;
  v_month_name := to_char(v_start_date, 'FMMonth YYYY');

  IF v_settings.working_days_method = 'fixed_30' THEN
    v_working_days := 30;
  ELSIF v_settings.working_days_method = 'fixed_26' THEN
    v_working_days := 26;
  ELSE
    v_working_days := EXTRACT(DAY FROM v_end_date)::integer;
  END IF;

  INSERT INTO public.payroll_runs (
    organization_id, month, year, title, status, processed_by, processed_at
  )
  VALUES (
    _organization_id, _month, _year, 'Payroll - ' || v_month_name, 'draft', _user_id, now()
  )
  ON CONFLICT (organization_id, year, month)
  DO UPDATE SET
    title = 'Payroll - ' || v_month_name,
    status = CASE WHEN payroll_runs.status = 'locked' THEN 'locked' ELSE 'draft' END,
    processed_by = _user_id,
    processed_at = now(),
    updated_at = now()
  RETURNING id INTO v_run_id;

  IF EXISTS (SELECT 1 FROM public.payroll_runs WHERE id = v_run_id AND status = 'locked') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll run is locked and cannot be recalculated.');
  END IF;

  DELETE FROM public.payslips WHERE payroll_run_id = v_run_id;

  FOR v_emp IN
    SELECT e.id, e.full_name, e.employee_code, e.bank_name, e.bank_account_number, e.pan_number
    FROM public.employees e
    WHERE e.organization_id = _organization_id
      AND e.is_superadmin IS NOT TRUE
      AND COALESCE(e.status, 'active') NOT IN ('relieved', 'terminated')
  LOOP
    SELECT * INTO v_struct
    FROM public.employee_salary_structures
    WHERE employee_id = v_emp.id AND is_active = true
    ORDER BY effective_from DESC LIMIT 1;

    IF FOUND THEN
      v_basic := v_struct.basic_salary;
      v_hra := v_struct.hra;
      v_special := v_struct.special_allowance;
      v_conveyance := v_struct.conveyance_allowance;
      v_medical := v_struct.medical_allowance;
      v_other_allowances := v_struct.other_allowances;
    ELSE
      v_basic := 25000.00;
      v_hra := 12500.00;
      v_special := 9500.00;
      v_conveyance := 1500.00;
      v_medical := 1500.00;
      v_other_allowances := 0;
    END IF;

    SELECT
      COALESCE(COUNT(*), 0),
      COALESCE(SUM(overtime_hours), 0)
    INTO v_present_days, v_overtime_hours
    FROM public.attendance
    WHERE employee_id = v_emp.id
      AND date >= v_start_date AND date <= v_end_date
      AND status IN ('present', 'late', 'half_day');

    SELECT COALESCE(SUM(days), 0)
    INTO v_unpaid_leave_days
    FROM public.leave_requests
    WHERE employee_id = v_emp.id
      AND status = 'approved'
      AND from_date <= v_end_date AND to_date >= v_start_date;

    IF v_present_days = 0 AND v_unpaid_leave_days = 0 THEN
      v_present_days := v_working_days;
      v_lop_days := 0;
    ELSE
      v_lop_days := GREATEST(0, v_working_days - (v_present_days + v_unpaid_leave_days));
    END IF;

    v_overtime_pay := ROUND((v_overtime_hours * ((v_basic / v_working_days) / 8.0) * v_settings.overtime_multiplier), 2);
    v_gross := v_basic + v_hra + v_special + v_conveyance + v_medical + v_other_allowances + v_overtime_pay;
    v_lop_deduction := ROUND(((v_gross / v_working_days) * v_lop_days), 2);

    IF v_settings.pf_enabled AND (v_struct.pf_applicable IS NULL OR v_struct.pf_applicable = true) THEN
      IF v_settings.pf_ceiling_enabled AND (v_struct.pf_cap_at_ceiling IS NULL OR v_struct.pf_cap_at_ceiling = true) THEN
        v_pf_emp := ROUND((LEAST(v_basic, v_settings.pf_wage_ceiling) * (v_settings.pf_employee_rate / 100.0)), 2);
        v_pf_empr := ROUND((LEAST(v_basic, v_settings.pf_wage_ceiling) * (v_settings.pf_employer_rate / 100.0)), 2);
      ELSE
        v_pf_emp := ROUND((v_basic * (v_settings.pf_employee_rate / 100.0)), 2);
        v_pf_empr := ROUND((v_basic * (v_settings.pf_employer_rate / 100.0)), 2);
      END IF;
    ELSE
      v_pf_emp := 0;
      v_pf_empr := 0;
    END IF;

    IF v_settings.esi_enabled AND v_gross <= v_settings.esi_gross_ceiling AND (v_struct.esi_applicable IS NULL OR v_struct.esi_applicable = true) THEN
      v_esi_emp := ROUND((v_gross * (v_settings.esi_employee_rate / 100.0)), 2);
      v_esi_empr := ROUND((v_gross * (v_settings.esi_employer_rate / 100.0)), 2);
    ELSE
      v_esi_emp := 0;
      v_esi_empr := 0;
    END IF;

    IF v_settings.pt_enabled AND (v_struct.pt_applicable IS NULL OR v_struct.pt_applicable = true) THEN
      IF v_gross >= 15000 THEN
        v_pt := 200.00;
      ELSE
        v_pt := 0.00;
      END IF;
    ELSE
      v_pt := 0;
    END IF;

    v_tds := COALESCE(v_struct.tds_monthly, 0.00);
    v_total_deductions := v_pf_emp + v_esi_emp + v_pt + v_tds + v_lop_deduction;
    v_net := GREATEST(0, v_gross - v_total_deductions);

    INSERT INTO public.payslips (
      employee_id, organization_id, payroll_run_id, month, year,
      basic_salary, hra, special_allowance, conveyance_allowance, medical_allowance,
      other_allowances, allowances, bonus, overtime_hours, overtime_pay,
      gross_salary, pf_employee, pf_employer, esi_employee, esi_employer,
      professional_tax, tds, lop_days, lop_deduction, other_deductions,
      deductions, total_deductions, net_salary, working_days, present_days, leave_days,
      bank_name, account_number, pan_number, uan_number, status,
      earnings_breakdown, deductions_breakdown
    )
    VALUES (
      v_emp.id, _organization_id, v_run_id, _month, _year,
      v_basic, v_hra, v_special, v_conveyance, v_medical,
      v_other_allowances, (v_hra + v_special + v_conveyance + v_medical + v_other_allowances),
      0, v_overtime_hours, v_overtime_pay,
      v_gross, v_pf_emp, v_pf_empr, v_esi_emp, v_esi_empr,
      v_pt, v_tds, v_lop_days, v_lop_deduction, 0,
      v_total_deductions, v_total_deductions, v_net, v_working_days, v_present_days, v_unpaid_leave_days,
      COALESCE(v_struct.bank_name, v_emp.bank_name),
      COALESCE(v_struct.bank_account_number, v_emp.bank_account_number),
      COALESCE(v_struct.pan_number, v_emp.pan_number),
      v_struct.uan_number,
      'draft',
      jsonb_build_object(
        'basic', v_basic,
        'hra', v_hra,
        'special_allowance', v_special,
        'conveyance_allowance', v_conveyance,
        'medical_allowance', v_medical,
        'overtime_pay', v_overtime_pay
      ),
      jsonb_build_object(
        'pf_employee', v_pf_emp,
        'esi_employee', v_esi_emp,
        'professional_tax', v_pt,
        'tds', v_tds,
        'lop_deduction', v_lop_deduction
      )
    );

    v_tot_employees := v_tot_employees + 1;
    v_tot_gross := v_tot_gross + v_gross;
    v_tot_deductions := v_tot_deductions + v_total_deductions;
    v_tot_net := v_tot_net + v_net;
    v_tot_pf_emp := v_tot_pf_emp + v_pf_emp;
    v_tot_pf_empr := v_tot_pf_empr + v_pf_empr;
    v_tot_esi_emp := v_tot_esi_emp + v_esi_emp;
    v_tot_esi_empr := v_tot_esi_empr + v_esi_empr;
    v_tot_pt := v_tot_pt + v_pt;
    v_tot_tds := v_tot_tds + v_tds;
    v_tot_lop := v_tot_lop + v_lop_deduction;
  END LOOP;

  UPDATE public.payroll_runs
  SET
    total_employees = v_tot_employees,
    total_gross = v_tot_gross,
    total_deductions = v_tot_deductions,
    total_net = v_tot_net,
    total_pf_employee = v_tot_pf_emp,
    total_pf_employer = v_tot_pf_empr,
    total_esi_employee = v_tot_esi_emp,
    total_esi_employer = v_tot_esi_empr,
    total_pt = v_tot_pt,
    total_tds = v_tot_tds,
    total_lop_deductions = v_tot_lop,
    status = 'in_review',
    updated_at = now()
  WHERE id = v_run_id;

  INSERT INTO public.payroll_history (
    payroll_run_id, organization_id, changed_by_user_id, action, from_status, to_status, notes
  )
  VALUES (
    v_run_id, _organization_id, _user_id, 'calculated', 'draft', 'in_review',
    'Payroll calculated for ' || v_tot_employees || ' employees.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'payroll_run_id', v_run_id,
    'total_employees', v_tot_employees,
    'total_gross', v_tot_gross,
    'total_net', v_tot_net
  );
END;
$$;

-- ============================================================================
-- 5. Hardened Root Superadmin RPCs (auth.uid() checked, safe tokens, no anon/PUBLIC)
-- ============================================================================
DROP FUNCTION IF EXISTS public.superadmin_provision_user(text, text, text, text, uuid, text, text);

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
  ELSIF v_norm_role = 'admin' THEN
    v_role := 'admin'::public.app_role;
    v_org_role := 'org_admin';
  ELSIF v_norm_role = 'manager' THEN
    v_role := 'manager'::public.app_role;
    v_org_role := 'hr_manager';
  ELSE
    v_norm_role := 'employee';
    v_role := 'employee'::public.app_role;
    v_org_role := 'employee';
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
      designation      = COALESCE(NULLIF(trim(p_designation), ''), designation),
      phone            = COALESCE(NULLIF(trim(p_phone), ''), phone),
      organization_id  = COALESCE(organization_id, v_org_id),
      work_location_id = CASE WHEN v_is_super THEN NULL ELSE COALESCE(work_location_id, v_work_loc_id) END,
      is_superadmin    = (is_superadmin OR v_is_super),
      status           = 'active',
      user_id          = v_user_id,
      updated_at       = now()
    WHERE user_id = v_user_id OR lower(email) = v_clean_email
    RETURNING id INTO v_emp_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'updated',
      'user_id', v_user_id,
      'employee_id', v_emp_id,
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
    designation      = COALESCE(
      NULLIF(trim(p_designation), ''),
      CASE WHEN v_is_super THEN 'Root Super Administrator' WHEN v_norm_role = 'admin' THEN 'Administrator' WHEN v_norm_role = 'manager' THEN 'Team Manager' ELSE 'Staff' END
    ),
    phone            = NULLIF(trim(p_phone), ''),
    organization_id  = v_org_id,
    work_location_id = CASE WHEN v_is_super THEN NULL ELSE v_work_loc_id END,
    is_superadmin    = v_is_super,
    status           = 'active',
    user_id          = v_user_id,
    updated_at       = now()
  WHERE user_id = v_user_id OR lower(email) = v_clean_email
  RETURNING id INTO v_emp_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'created',
    'user_id', v_user_id,
    'employee_id', v_emp_id,
    'email', v_clean_email,
    'role', v_norm_role,
    'is_superadmin', v_is_super,
    'status', 'created'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_set_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
  v_app_role public.app_role;
  v_org_role text;
  v_is_super boolean := false;
  v_default_desig text;
  v_norm text := lower(trim(COALESCE(p_new_role, '')));
BEGIN
  IF v_jwt_role = 'anon' OR (v_caller IS NULL AND v_jwt_role <> 'service_role') OR (v_caller IS NOT NULL AND NOT public.is_superadmin(v_caller)) THEN
    RAISE EXCEPTION 'Forbidden: Root Superadmin access required.' USING ERRCODE = '42501';
  END IF;

  IF v_caller IS NOT NULL AND p_target_user_id = v_caller AND v_norm NOT IN ('superadmin', 'super_admin') THEN
    RAISE EXCEPTION 'Safety check: Cannot downgrade your own active Root Superadmin account.';
  END IF;

  IF v_norm IN ('superadmin', 'super_admin') THEN
    v_norm := 'superadmin';
    v_app_role := 'admin'::public.app_role;
    v_org_role := 'super_admin';
    v_is_super := true;
    v_default_desig := 'Root Super Administrator';
  ELSIF v_norm = 'admin' THEN
    v_app_role := 'admin'::public.app_role;
    v_org_role := 'org_admin';
    v_default_desig := 'Administrator';
  ELSIF v_norm = 'manager' THEN
    v_app_role := 'manager'::public.app_role;
    v_org_role := 'hr_manager';
    v_default_desig := 'Team Manager';
  ELSIF v_norm = 'employee' THEN
    v_app_role := 'employee'::public.app_role;
    v_org_role := 'employee';
    v_default_desig := 'Staff';
  ELSE
    RAISE EXCEPTION 'Invalid role: %. Must be superadmin, admin, manager, or employee.', p_new_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_target_user_id, v_app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = v_app_role;

  UPDATE public.organization_members
  SET role = v_org_role
  WHERE user_id = p_target_user_id;

  UPDATE public.employees
  SET is_superadmin = v_is_super,
      designation = COALESCE(NULLIF(designation, ''), v_default_desig),
      work_location_id = CASE WHEN v_is_super THEN NULL ELSE work_location_id END,
      updated_at = now()
  WHERE user_id = p_target_user_id;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_norm),
      updated_at = now()
  WHERE id = p_target_user_id;

  INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
  VALUES (
    v_caller,
    (SELECT email FROM auth.users WHERE id = v_caller),
    'SUPERADMIN_ROLE_CHANGE',
    jsonb_build_object('target_user_id', p_target_user_id, 'new_role', v_norm, 'app_role', v_app_role, 'org_role', v_org_role, 'is_superadmin', v_is_super),
    p_target_user_id
  );

  RETURN jsonb_build_object('success', true, 'new_role', v_norm, 'org_role', v_org_role, 'is_superadmin', v_is_super);
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_toggle_user_status(
  p_target_user_id uuid,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
  v_status text := CASE WHEN p_active THEN 'active' ELSE 'inactive' END;
BEGIN
  IF v_jwt_role = 'anon' OR (v_caller IS NULL AND v_jwt_role <> 'service_role') OR (v_caller IS NOT NULL AND NOT public.is_superadmin(v_caller)) THEN
    RAISE EXCEPTION 'Forbidden: Root Superadmin access required.' USING ERRCODE = '42501';
  END IF;

  IF v_caller IS NOT NULL AND p_target_user_id = v_caller AND NOT p_active THEN
    RAISE EXCEPTION 'Safety check: Cannot suspend your own active Root Superadmin account.';
  END IF;

  UPDATE public.employees
  SET status = v_status, updated_at = now()
  WHERE user_id = p_target_user_id;

  UPDATE auth.users
  SET banned_until = CASE WHEN p_active THEN NULL ELSE '2099-01-01 00:00:00+00'::timestamptz END,
      updated_at = now()
  WHERE id = p_target_user_id;

  INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
  VALUES (
    v_caller,
    (SELECT email FROM auth.users WHERE id = v_caller),
    'SUPERADMIN_STATUS_TOGGLE',
    jsonb_build_object('target_user_id', p_target_user_id, 'active', p_active, 'status', v_status),
    p_target_user_id
  );

  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_reset_user_password(
  p_target_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
BEGIN
  IF v_jwt_role = 'anon' OR (v_caller IS NULL AND v_jwt_role <> 'service_role') OR (v_caller IS NOT NULL AND NOT public.is_superadmin(v_caller)) THEN
    RAISE EXCEPTION 'Forbidden: Root Superadmin access required.' USING ERRCODE = '42501';
  END IF;

  IF p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(trim(p_new_password), extensions.gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_target_user_id;

  INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
  VALUES (
    v_caller,
    (SELECT email FROM auth.users WHERE id = v_caller),
    'SUPERADMIN_PASSWORD_RESET',
    jsonb_build_object('target_user_id', p_target_user_id),
    p_target_user_id
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

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

-- ============================================================================
-- 6. Hierarchical Access Provisioning & Org Role Management RPCs
--    Org Admin  -> can provision/assign 'manager' and 'employee' (in own org)
--    Manager    -> can provision 'employee' ONLY (in own org & team)
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_create_employee_v2(
  text, text, text, text, text, text, text, uuid, date, text, text, uuid,
  text, text, date, text, text, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.admin_create_employee_v2(
  p_email text,
  p_password text,
  p_full_name text,
  p_department text DEFAULT 'General'::text,
  p_designation text DEFAULT 'Employee'::text,
  p_phone text DEFAULT NULL::text,
  p_person_code text DEFAULT NULL::text,
  p_manager_id uuid DEFAULT NULL::uuid,
  p_joining_date date DEFAULT CURRENT_DATE,
  p_employment_type text DEFAULT 'full_time'::text,
  p_work_location text DEFAULT 'onsite'::text,
  p_shift_id uuid DEFAULT NULL::uuid,
  p_personal_email text DEFAULT NULL::text,
  p_gender text DEFAULT NULL::text,
  p_date_of_birth date DEFAULT NULL::date,
  p_blood_group text DEFAULT NULL::text,
  p_marital_status text DEFAULT NULL::text,
  p_current_address text DEFAULT NULL::text,
  p_permanent_address text DEFAULT NULL::text,
  p_emergency_contact_name text DEFAULT NULL::text,
  p_emergency_contact_phone text DEFAULT NULL::text,
  p_emergency_contact_relation text DEFAULT NULL::text,
  p_role text DEFAULT 'employee'::text
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
  v_caller_is_manager boolean := false;
  v_caller_emp_id uuid;
  v_caller_org_id uuid;
  v_caller_dept_name text;
  v_target_role text := lower(trim(COALESCE(NULLIF(p_role, ''), 'employee')));
  v_app_role public.app_role;
  v_org_role text;
  v_user_id uuid;
  v_emp_id uuid;
  v_dept_id uuid;
  v_effective_dept text;
  v_effective_manager_id uuid;
  v_effective_desig text;
  v_work_loc_id uuid;
  v_hash text;
  v_existing_id uuid;
  v_code text;
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
    v_caller_is_manager := NOT v_caller_is_super AND NOT v_caller_is_admin AND (
      public.has_role(v_caller_uid, 'manager'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = v_caller_uid AND om.status = 'active' AND om.role = 'hr_manager'
      )
    );

    IF NOT (v_caller_is_super OR v_caller_is_admin OR v_caller_is_manager) THEN
      RAISE EXCEPTION 'Access denied. Insufficient privileges to create accounts.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    -- service_role invocation
    v_caller_is_super := true;
  END IF;

  -- Enforce strict hierarchical role assignment
  IF v_target_role IN ('superadmin', 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden: Superadmin accounts can only be managed from the Root Superadmin console.'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_role NOT IN ('employee', 'manager', 'admin') THEN
    RAISE EXCEPTION 'Invalid role %. Allowed: employee, manager.', p_role;
  END IF;

  IF v_caller_is_manager AND v_target_role <> 'employee' THEN
    RAISE EXCEPTION 'Access denied: Managers can only grant Employee access.'
      USING ERRCODE = '42501';
  END IF;

  IF v_caller_is_admin AND v_target_role = 'admin' THEN
    RAISE EXCEPTION 'Access denied: Only Root Superadmin can grant Admin access.'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_role = 'admin' THEN
    v_app_role := 'admin'::public.app_role;
    v_org_role := 'org_admin';
  ELSIF v_target_role = 'manager' THEN
    v_app_role := 'manager'::public.app_role;
    v_org_role := 'hr_manager';
  ELSE
    v_app_role := 'employee'::public.app_role;
    v_org_role := 'employee';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required for account login.';
  END IF;
  IF p_password IS NULL OR length(trim(p_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Full name is required.';
  END IF;

  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'An account with email % already exists.', lower(trim(p_email));
  END IF;
  IF EXISTS (SELECT 1 FROM public.employees WHERE lower(email) = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'An employee with email % already exists.', lower(trim(p_email));
  END IF;

  -- Resolve caller organization & manager context
  IF v_caller_uid IS NOT NULL THEN
    SELECT e.id, e.organization_id, d.name
    INTO v_caller_emp_id, v_caller_org_id, v_caller_dept_name
    FROM public.employees e
    LEFT JOIN public.departments d ON d.id = e.department_id
    WHERE e.user_id = v_caller_uid
    LIMIT 1;
  END IF;

  IF v_caller_org_id IS NULL THEN
    v_caller_org_id := public.current_employee_org_id();
  END IF;
  IF v_caller_org_id IS NULL THEN
    SELECT id INTO v_caller_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF v_caller_org_id IS NULL THEN
    v_caller_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  SELECT id INTO v_work_loc_id
  FROM public.work_locations
  WHERE organization_id = v_caller_org_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  -- Resolve department
  v_effective_dept := COALESCE(NULLIF(trim(p_department), ''), v_caller_dept_name, 'General');
  SELECT id INTO v_dept_id FROM public.departments WHERE lower(name) = lower(v_effective_dept) LIMIT 1;
  IF v_dept_id IS NULL THEN
    IF v_caller_is_manager AND v_caller_dept_name IS NOT NULL THEN
      SELECT id INTO v_dept_id FROM public.departments WHERE lower(name) = lower(v_caller_dept_name) LIMIT 1;
    ELSE
      INSERT INTO public.departments (name) VALUES (v_effective_dept) RETURNING id INTO v_dept_id;
    END IF;
  END IF;

  -- Force manager assignment when created by a Manager so employee is scoped to their team
  IF v_caller_is_manager AND v_caller_emp_id IS NOT NULL THEN
    v_effective_manager_id := v_caller_emp_id;
  ELSE
    v_effective_manager_id := p_manager_id;
  END IF;

  v_effective_desig := COALESCE(
    NULLIF(trim(p_designation), ''),
    CASE WHEN v_target_role = 'manager' THEN 'Team Manager' WHEN v_target_role = 'admin' THEN 'Administrator' ELSE 'Employee' END
  );

  -- Determine unique employee code
  v_code := NULLIF(trim(p_person_code), '');
  IF v_code IS NULL OR EXISTS (SELECT 1 FROM public.employees WHERE lower(employee_code) = lower(v_code)) THEN
    v_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
    WHILE EXISTS (SELECT 1 FROM public.employees WHERE lower(employee_code) = lower(v_code)) LOOP
      v_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
    END LOOP;
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
    lower(trim(p_email)),
    v_hash,
    now(),
    '', '', '', '', '', '', '', '', 0,
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', v_target_role),
    jsonb_build_object('sub', v_user_id::text, 'name', trim(p_full_name), 'email', lower(trim(p_email)), 'email_verified', true, 'phone_verified', false),
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
    jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email)), 'email_verified', true, 'phone_verified', false),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, v_app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = v_app_role;

  DELETE FROM public.organization_members
  WHERE user_id = v_user_id AND organization_id <> v_caller_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_caller_org_id, v_user_id, v_org_role, 'active')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = v_org_role, status = 'active';

  UPDATE public.employees
  SET
    full_name                  = trim(p_full_name),
    department_id              = v_dept_id,
    designation                = v_effective_desig,
    phone                      = NULLIF(trim(p_phone), ''),
    employee_code              = v_code,
    manager_id                 = v_effective_manager_id,
    organization_id            = v_caller_org_id,
    work_location_id           = COALESCE(work_location_id, v_work_loc_id),
    joining_date               = COALESCE(p_joining_date, CURRENT_DATE),
    employment_type            = COALESCE(p_employment_type, 'full_time'),
    work_location              = COALESCE(p_work_location, 'onsite'),
    shift_id                   = p_shift_id,
    personal_email             = NULLIF(trim(p_personal_email), ''),
    gender                     = p_gender,
    date_of_birth              = p_date_of_birth,
    blood_group                = p_blood_group,
    marital_status             = p_marital_status,
    current_address            = p_current_address,
    permanent_address          = p_permanent_address,
    emergency_contact_name     = p_emergency_contact_name,
    emergency_contact_phone    = p_emergency_contact_phone,
    emergency_contact_relation = p_emergency_contact_relation,
    is_superadmin              = false,
    status                     = 'active',
    updated_at                 = now()
  WHERE user_id = v_user_id
  RETURNING id, employee_code INTO v_emp_id, v_code;

  IF v_emp_id IS NULL THEN
    INSERT INTO public.employees (
      user_id, organization_id, work_location_id, employee_code, full_name, email, phone,
      department_id, designation, manager_id, joining_date, employment_type, work_location,
      shift_id, personal_email, gender, date_of_birth, blood_group, marital_status,
      current_address, permanent_address, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relation, is_superadmin, status
    ) VALUES (
      v_user_id, v_caller_org_id, v_work_loc_id, v_code, trim(p_full_name), lower(trim(p_email)), NULLIF(trim(p_phone), ''),
      v_dept_id, v_effective_desig, v_effective_manager_id, COALESCE(p_joining_date, CURRENT_DATE),
      COALESCE(p_employment_type, 'full_time'), COALESCE(p_work_location, 'onsite'), p_shift_id,
      NULLIF(trim(p_personal_email), ''), p_gender, p_date_of_birth, p_blood_group, p_marital_status,
      p_current_address, p_permanent_address, p_emergency_contact_name, p_emergency_contact_phone,
      p_emergency_contact_relation, false, 'active'
    )
    RETURNING id, employee_code INTO v_emp_id, v_code;
  END IF;

  INSERT INTO public.employee_profile_history (employee_id, changed_by, action, changes)
  VALUES (
    v_emp_id,
    v_caller_uid,
    'REGISTERED',
    jsonb_build_object(
      'full_name', trim(p_full_name),
      'email', lower(trim(p_email)),
      'employee_code', v_code,
      'department', v_effective_dept,
      'designation', v_effective_desig,
      'role', v_target_role
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'employee_id', v_emp_id,
    'employee_code', v_code,
    'email', lower(trim(p_email)),
    'role', v_target_role
  );
END;
$$;

-- Delegate legacy 6-arg admin_create_employee safely so CSV import & managers share the exact same checks
CREATE OR REPLACE FUNCTION public.admin_create_employee(
  p_email text,
  p_password text,
  p_full_name text,
  p_department text DEFAULT 'General'::text,
  p_phone text DEFAULT NULL::text,
  p_person_code text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
BEGIN
  RETURN public.admin_create_employee_v2(
    p_email => p_email,
    p_password => p_password,
    p_full_name => p_full_name,
    p_department => p_department,
    p_designation => 'Employee',
    p_phone => p_phone,
    p_person_code => p_person_code,
    p_role => 'employee'
  );
END;
$$;

-- Org-level role switcher (Admin -> assigns Manager / Employee within own org ONLY)
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
      RAISE EXCEPTION 'Forbidden: Only organization administrators can manage user roles.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    v_caller_is_super := true;
  END IF;

  -- Never reveal or allow edits to Root Superadmin from organization tools
  IF NOT v_caller_is_super AND public.is_superadmin(p_target_user_id) THEN
    RAISE EXCEPTION 'Account not found in organization.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_caller_is_super THEN
    v_caller_org_id := public.current_employee_org_id();
    SELECT organization_id INTO v_target_org_id
    FROM public.employees
    WHERE user_id = p_target_user_id AND is_superadmin IS NOT TRUE
    LIMIT 1;

    IF v_target_org_id IS NULL OR v_caller_org_id IS NULL OR v_target_org_id <> v_caller_org_id THEN
      RAISE EXCEPTION 'Account not found in organization.' USING ERRCODE = 'P0002';
    END IF;

    IF v_norm_role NOT IN ('manager', 'employee') THEN
      RAISE EXCEPTION 'Forbidden: Administrators can only assign Manager or Employee roles.'
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

  UPDATE public.organization_members
  SET role = v_org_role, status = 'active'
  WHERE user_id = p_target_user_id
    AND (v_caller_is_super OR organization_id = v_caller_org_id);

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

-- ============================================================================
-- 7. Strict Function Execute Grants (Revoke PUBLIC & anon)
-- ============================================================================
REVOKE ALL ON FUNCTION public.superadmin_provision_user(text, text, text, text, uuid, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.superadmin_set_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.superadmin_toggle_user_status(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.superadmin_reset_user_password(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.superadmin_delete_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_employee(text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_employee_v2(text, text, text, text, text, text, text, uuid, date, text, text, uuid, text, text, date, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manage_org_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_reports_analytics_overview(uuid, date, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calculate_monthly_payroll_run(uuid, integer, integer, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.superadmin_provision_user(text, text, text, text, uuid, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.superadmin_set_user_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.superadmin_toggle_user_status(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.superadmin_reset_user_password(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.superadmin_delete_user(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_employee(text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_employee_v2(text, text, text, text, text, text, text, uuid, date, text, text, uuid, text, text, date, text, text, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manage_org_user_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_reports_analytics_overview(uuid, date, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_monthly_payroll_run(uuid, integer, integer, uuid) TO authenticated, service_role;
