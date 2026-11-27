-- ============================================================================
-- Migration: Restrict HR/Admin Leave Day & Balance Editing Strictly to HR Admin
-- & Harden admin_adjust_leave_balance with Audit Logging + Org Validation
-- ============================================================================

-- 1. Align is_hr_or_admin with Superadmin -> Admin (HR) -> Manager / Employee hierarchy.
--    Note: Team Managers carry organization_members.role = 'hr_manager' and
--    user_roles.role = 'manager', so only super_admin / org_admin / admin qualify as HR/Admin.
CREATE OR REPLACE FUNCTION public.is_hr_or_admin(p_org_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.user_id = (SELECT auth.uid())
          AND e.is_superadmin = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.role::text IN ('admin', 'superadmin')
          AND (
            p_org_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM public.employees ce
              WHERE ce.user_id = (SELECT auth.uid())
                AND ce.organization_id = p_org_id
            )
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = (SELECT auth.uid())
          AND om.status = 'active'
          AND om.role IN ('super_admin', 'org_admin')
          AND (p_org_id IS NULL OR om.organization_id = p_org_id)
      )
    );
$$;

-- 2. Harden admin_adjust_leave_balance:
--    - Safe search_path including pg_temp
--    - Stealth check on Root Superadmin targets
--    - Org match check on leave_type_id
--    - Audit logging on leave day edits
CREATE OR REPLACE FUNCTION public.admin_adjust_leave_balance(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_year integer,
  p_total numeric,
  p_used numeric DEFAULT 0,
  p_carried_forward numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_emp record;
  v_lt_org uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT id, user_id, organization_id, is_superadmin INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND OR (v_emp.is_superadmin IS TRUE AND NOT public.is_superadmin(v_caller)) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  IF NOT public.is_hr_or_admin(v_emp.organization_id) THEN
    RAISE EXCEPTION 'Forbidden: only HR Admin can edit leave days and balances' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id INTO v_lt_org
  FROM public.leave_types
  WHERE id = p_leave_type_id;

  IF NOT FOUND OR (v_lt_org IS NOT NULL AND v_lt_org <> v_emp.organization_id) THEN
    RAISE EXCEPTION 'Leave category not found in organization';
  END IF;

  IF p_total < 0 OR p_used < 0 OR p_carried_forward < 0 THEN
    RAISE EXCEPTION 'Leave balance values cannot be negative';
  END IF;

  INSERT INTO public.leave_balances (
    employee_id, leave_type_id, year, total, used, carried_forward, organization_id
  ) VALUES (
    p_employee_id, p_leave_type_id, p_year, p_total, p_used, p_carried_forward, v_emp.organization_id
  )
  ON CONFLICT (employee_id, leave_type_id, year) DO UPDATE
  SET total = EXCLUDED.total,
      used = EXCLUDED.used,
      carried_forward = EXCLUDED.carried_forward;

  INSERT INTO public.audit_logs (user_id, user_email, action, details, target_user_id)
  VALUES (
    v_caller,
    (SELECT email FROM auth.users WHERE id = v_caller),
    'LEAVE_DAYS_ADJUSTED',
    jsonb_build_object(
      'employee_id', p_employee_id,
      'leave_type_id', p_leave_type_id,
      'year', p_year,
      'total', p_total,
      'used', p_used,
      'carried_forward', p_carried_forward
    ),
    v_emp.user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'employee_id', p_employee_id,
    'leave_type_id', p_leave_type_id,
    'year', p_year,
    'total', p_total,
    'used', p_used,
    'carried_forward', p_carried_forward,
    'remaining', p_total - p_used
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_leave_balance(uuid, uuid, integer, numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_leave_balance(uuid, uuid, integer, numeric, numeric, numeric) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
