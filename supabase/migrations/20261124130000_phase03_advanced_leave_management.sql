-- 20261124130000_phase03_advanced_leave_management.sql
-- FLOWPEOPLE PHASE 03: Advanced Leave Management
-- Additive migration for comprehensive organization-specific leave policies, multi-level approvals,
-- annual allocation, carry-forward, encashment, safe concurrency control, and transactional operations.

-- 1. Extend public.leave_types table
ALTER TABLE public.leave_types
ADD COLUMN IF NOT EXISTS code text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS color text DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS allow_half_day boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_carry_forward boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS max_carry_forward_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS allow_encashment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS max_encashment_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS requires_manager_approval boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS requires_hr_approval boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS max_consecutive_days integer DEFAULT 14,
ADD COLUMN IF NOT EXISTS min_service_days_required integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_document_proof boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS document_proof_min_days integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS organization_id uuid,
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();

-- Seed / Standardize Core Leave Types
-- Casual Leave (CL)
INSERT INTO public.leave_types (name, code, days_per_year, is_paid, allow_half_day, allow_carry_forward, max_carry_forward_days, allow_encashment, color, description, active)
SELECT 'Casual Leave', 'CL', 12, true, true, false, 0, false, '#3b82f6', 'Short-term personal time off and urgent personal matters', true
WHERE NOT EXISTS (SELECT 1 FROM public.leave_types WHERE code = 'CL' OR name ILIKE 'Casual Leave%');

UPDATE public.leave_types
SET code = 'CL', color = '#3b82f6', allow_half_day = true, days_per_year = 12
WHERE name ILIKE 'Casual Leave%' AND code IS NULL;

-- Sick Leave (SL)
INSERT INTO public.leave_types (name, code, days_per_year, is_paid, allow_half_day, allow_carry_forward, max_carry_forward_days, requires_document_proof, document_proof_min_days, color, description, active)
SELECT 'Sick Leave', 'SL', 10, true, true, false, 0, true, 2, '#ef4444', 'Medical recovery, sick rest, and healthcare consultations', true
WHERE NOT EXISTS (SELECT 1 FROM public.leave_types WHERE code = 'SL' OR name ILIKE 'Sick Leave%');

UPDATE public.leave_types
SET code = 'SL', color = '#ef4444', allow_half_day = true, requires_document_proof = true, document_proof_min_days = 2
WHERE name ILIKE 'Sick Leave%' AND code IS NULL;

-- Earned / Annual Leave (EL)
INSERT INTO public.leave_types (name, code, days_per_year, is_paid, allow_half_day, allow_carry_forward, max_carry_forward_days, allow_encashment, max_encashment_days, color, description, active)
SELECT 'Earned Leave', 'EL', 15, true, true, true, 30, true, 15, '#10b981', 'Annual vacation and planned privilege time off accumulated over service', true
WHERE NOT EXISTS (SELECT 1 FROM public.leave_types WHERE code = 'EL' OR name ILIKE 'Earned Leave%');

UPDATE public.leave_types
SET code = 'EL', color = '#10b981', allow_carry_forward = true, max_carry_forward_days = 30, allow_encashment = true
WHERE name ILIKE 'Earned Leave%' AND code IS NULL;

-- Paid Time Off (PTO)
INSERT INTO public.leave_types (name, code, days_per_year, is_paid, allow_half_day, allow_carry_forward, color, description, active)
SELECT 'Paid Time Off', 'PTO', 5, true, true, false, '#8b5cf6', 'General flexible paid leaves', true
WHERE NOT EXISTS (SELECT 1 FROM public.leave_types WHERE code = 'PTO' OR name ILIKE 'Paid Time Off%');

UPDATE public.leave_types
SET code = 'PTO', color = '#8b5cf6'
WHERE name ILIKE 'Paid Time Off%' AND code IS NULL;

-- Leave Without Pay / Unpaid Leave (LWP)
INSERT INTO public.leave_types (name, code, days_per_year, is_paid, allow_half_day, allow_carry_forward, color, description, active)
SELECT 'Leave Without Pay', 'LWP', 365, false, true, false, '#64748b', 'Extended unpaid personal leaves with zero salary entitlement', true
WHERE NOT EXISTS (SELECT 1 FROM public.leave_types WHERE code = 'LWP' OR name ILIKE 'Leave Without Pay%' OR name ILIKE 'Unpaid%');

UPDATE public.leave_types
SET code = 'LWP', color = '#64748b', is_paid = false
WHERE (name ILIKE 'Leave Without Pay%' OR name ILIKE 'Unpaid%') AND code IS NULL;

-- Optional / Floating Holiday (OH)
INSERT INTO public.leave_types (name, code, days_per_year, is_paid, allow_half_day, allow_carry_forward, color, description, active)
SELECT 'Optional Holiday', 'OH', 2, true, false, false, '#f59e0b', 'Floating religious or regional cultural holidays chosen by the employee', true
WHERE NOT EXISTS (SELECT 1 FROM public.leave_types WHERE code = 'OH' OR name ILIKE 'Optional Holiday%');

UPDATE public.leave_types
SET code = 'OH', color = '#f59e0b'
WHERE name ILIKE 'Optional Holiday%' AND code IS NULL;


-- 2. Extend public.leave_balances table
ALTER TABLE public.leave_balances
ADD COLUMN IF NOT EXISTS carried_forward numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS encashed numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Add unique constraint on (employee_id, leave_type_id, year) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_employee_leave_type_year'
  ) THEN
    ALTER TABLE public.leave_balances
    ADD CONSTRAINT unique_employee_leave_type_year UNIQUE (employee_id, leave_type_id, year);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON public.leave_balances(employee_id, year);


-- 3. Extend public.leave_requests table
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS current_approval_level text DEFAULT 'manager',
ADD COLUMN IF NOT EXISTS manager_decision text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS manager_decision_at timestamptz,
ADD COLUMN IF NOT EXISTS admin_decision text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS admin_decision_at timestamptz,
ADD COLUMN IF NOT EXISTS half_day_period text DEFAULT 'full_day',
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
ADD COLUMN IF NOT EXISTS cancelled_by uuid,
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS organization_id uuid;

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status ON public.leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(from_date, to_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_level_status ON public.leave_requests(current_approval_level, status);


-- 4. Create public.leave_policies table
CREATE TABLE IF NOT EXISTS public.leave_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL DEFAULT 'Standard Leave Policy',
  weekly_off_days integer[] DEFAULT ARRAY[0, 6], -- 0 = Sunday, 6 = Saturday
  approval_flow text DEFAULT 'manager_then_admin', -- manager_only, admin_only, manager_then_admin
  sandwich_rule_enabled boolean DEFAULT false,
  allow_negative_balance boolean DEFAULT false,
  notice_days_required integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Seed default policy if empty
INSERT INTO public.leave_policies (name, weekly_off_days, approval_flow, sandwich_rule_enabled, is_active)
SELECT 'Standard Corporate Leave Policy', ARRAY[0, 6], 'manager_then_admin', false, true
WHERE NOT EXISTS (SELECT 1 FROM public.leave_policies LIMIT 1);


-- 5. Safe Transactional RPC Functions

-- A. Apply for Leave Transactional
CREATE OR REPLACE FUNCTION public.apply_leave_transactional(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_from_date date,
  p_to_date date,
  p_days numeric,
  p_half_day boolean DEFAULT false,
  p_half_day_period text DEFAULT 'full_day',
  p_reason text DEFAULT NULL,
  p_attachment_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_uid uuid;
  v_emp record;
  v_leave_type record;
  v_balance record;
  v_overlap_count integer;
  v_manager_id uuid;
  v_approval_level text;
  v_new_req_id uuid;
  v_req_year integer;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to apply for leave';
  END IF;

  -- Verify employee ownership or admin
  SELECT e.id, e.user_id, e.manager_id, e.organization_id, e.full_name
  INTO v_emp
  FROM public.employees e
  WHERE e.id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee profile not found';
  END IF;

  IF v_emp.user_id != v_caller_uid AND NOT (
    public.has_role(v_caller_uid, 'admin') OR public.is_superadmin(v_caller_uid)
  ) THEN
    RAISE EXCEPTION 'You are not authorized to submit leave for another employee';
  END IF;

  IF p_to_date < p_from_date THEN
    RAISE EXCEPTION 'End date cannot be earlier than start date';
  END IF;

  IF p_days <= 0 THEN
    RAISE EXCEPTION 'Calculated leave duration must be greater than zero working days';
  END IF;

  -- Concurrency check: prevent overlapping pending or approved leave
  SELECT COUNT(*) INTO v_overlap_count
  FROM public.leave_requests lr
  WHERE lr.employee_id = p_employee_id
    AND lr.status IN ('pending', 'approved')
    AND lr.from_date <= p_to_date
    AND lr.to_date >= p_from_date;

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'An overlapping leave request already exists for this date range';
  END IF;

  -- Verify leave type
  SELECT * INTO v_leave_type
  FROM public.leave_types
  WHERE id = p_leave_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid leave type selected';
  END IF;

  IF p_half_day AND NOT COALESCE(v_leave_type.allow_half_day, true) THEN
    RAISE EXCEPTION 'Half-day is not permitted for %', v_leave_type.name;
  END IF;

  v_req_year := EXTRACT(YEAR FROM p_from_date)::integer;

  -- Balance validation for paid leave
  IF v_leave_type.is_paid THEN
    SELECT * INTO v_balance
    FROM public.leave_balances
    WHERE employee_id = p_employee_id
      AND leave_type_id = p_leave_type_id
      AND year = v_req_year
    FOR UPDATE;

    IF FOUND THEN
      IF (v_balance.total - v_balance.used) < p_days THEN
        RAISE EXCEPTION 'Insufficient leave balance. Available: % days, Requested: % days',
          (v_balance.total - v_balance.used), p_days;
      END IF;
    ELSE
      -- Auto-create balance entry if not initialized
      INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total, used, carried_forward, organization_id)
      VALUES (p_employee_id, p_leave_type_id, v_req_year, v_leave_type.days_per_year, 0, 0, v_emp.organization_id)
      ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
    END IF;
  END IF;

  -- Routing determination
  IF v_emp.manager_id IS NOT NULL AND v_emp.manager_id != p_employee_id THEN
    v_manager_id := v_emp.manager_id;
    v_approval_level := 'manager';
  ELSE
    v_manager_id := NULL;
    v_approval_level := 'admin';
  END IF;

  -- Insert record atomically
  INSERT INTO public.leave_requests (
    employee_id,
    leave_type_id,
    from_date,
    to_date,
    days,
    half_day,
    half_day_period,
    reason,
    attachment_url,
    status,
    current_approval_level,
    manager_id,
    organization_id,
    applied_at
  ) VALUES (
    p_employee_id,
    p_leave_type_id,
    p_from_date,
    p_to_date,
    p_days,
    p_half_day,
    p_half_day_period,
    trim(p_reason),
    p_attachment_url,
    'pending',
    v_approval_level,
    v_manager_id,
    v_emp.organization_id,
    NOW()
  )
  RETURNING id INTO v_new_req_id;

  RETURN jsonb_build_object(
    'success', true,
    'leave_request_id', v_new_req_id,
    'approval_level', v_approval_level,
    'days', p_days
  );
END;
$$;


-- B. Approve Leave Transactional (Multi-Level + Deductions + Attendance Sync)
CREATE OR REPLACE FUNCTION public.approve_leave_transactional(
  p_request_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_uid uuid;
  v_approver record;
  v_is_admin boolean := false;
  v_req record;
  v_policy record;
  v_leave_type record;
  v_cur_date date;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Identify approver employee record & admin status
  SELECT e.id, e.full_name, e.department_id, e.organization_id
  INTO v_approver
  FROM public.employees e
  WHERE e.user_id = v_caller_uid;

  v_is_admin := (public.has_role(v_caller_uid, 'admin') OR public.is_superadmin(v_caller_uid));

  -- Lock leave request row FOR UPDATE to handle concurrent clicks safely
  SELECT lr.*, e.user_id AS req_user_id, e.manager_id AS req_manager_id, lt.name AS leave_type_name, lt.is_paid
  INTO v_req
  FROM public.leave_requests lr
  JOIN public.employees e ON lr.employee_id = e.id
  JOIN public.leave_types lt ON lr.leave_type_id = lt.id
  WHERE lr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'Leave request has already been % and cannot be approved again', v_req.status;
  END IF;

  -- Fetch approval policy
  SELECT * INTO v_policy
  FROM public.leave_policies
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check Manager Step
  IF v_req.current_approval_level = 'manager' THEN
    -- Verify authority: must be direct manager or admin
    IF NOT v_is_admin AND (v_approver.id IS NULL OR v_req.req_manager_id != v_approver.id) THEN
      RAISE EXCEPTION 'Only the assigned reporting manager or an HR Administrator can approve this step';
    END IF;

    -- If policy requires 2-tier approval (manager then admin) and current approver is NOT an admin:
    IF COALESCE(v_policy.approval_flow, 'manager_then_admin') = 'manager_then_admin' AND NOT v_is_admin THEN
      UPDATE public.leave_requests
      SET manager_id = v_approver.id,
          manager_comment = trim(p_comment),
          manager_decision = 'approved',
          manager_decision_at = NOW(),
          current_approval_level = 'admin'
      WHERE id = p_request_id;

      RETURN jsonb_build_object(
        'success', true,
        'status', 'pending',
        'current_approval_level', 'admin',
        'message', 'Manager approval recorded. Forwarded to HR Admin for final sign-off.'
      );
    END IF;
  END IF;

  -- Admin Step or Final Approval Sign-Off
  IF v_req.current_approval_level = 'admin' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Final approval requires HR Administrator authority';
  END IF;

  -- Apply Final Approval
  UPDATE public.leave_requests
  SET status = 'approved',
      current_approval_level = 'completed',
      admin_id = COALESCE(v_approver.id, v_req.admin_id),
      admin_comment = CASE WHEN v_is_admin THEN trim(p_comment) ELSE v_req.admin_comment END,
      admin_decision = 'approved',
      admin_decision_at = NOW(),
      decided_at = NOW()
  WHERE id = p_request_id;

  -- Atomically deduct balance
  IF v_req.is_paid THEN
    UPDATE public.leave_balances
    SET used = used + v_req.days,
        remaining = total - (used + v_req.days)
    WHERE employee_id = v_req.employee_id
      AND leave_type_id = v_req.leave_type_id
      AND year = EXTRACT(YEAR FROM v_req.from_date)::integer;
  END IF;

  -- Automatically sync into public.attendance for every date in range
  v_cur_date := v_req.from_date;
  WHILE v_cur_date <= v_req.to_date LOOP
    -- Only sync on working days (skip Sundays/holidays if desired, or mark leave day)
    INSERT INTO public.attendance (
      employee_id,
      date,
      status,
      method,
      note,
      is_half_day,
      organization_id
    ) VALUES (
      v_req.employee_id,
      v_cur_date,
      'on_leave',
      'leave',
      'Approved ' || v_req.leave_type_name,
      v_req.half_day,
      v_req.organization_id
    )
    ON CONFLICT (employee_id, date) DO UPDATE
    SET status = 'on_leave',
        method = 'leave',
        note = 'Approved ' || v_req.leave_type_name,
        is_half_day = v_req.half_day;

    v_cur_date := v_cur_date + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'approved',
    'current_approval_level', 'completed',
    'message', 'Leave request fully approved. Balance ledger and attendance synchronized.'
  );
END;
$$;


-- C. Reject Leave Transactional
CREATE OR REPLACE FUNCTION public.reject_leave_transactional(
  p_request_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_uid uuid;
  v_approver record;
  v_is_admin boolean := false;
  v_req record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT e.id, e.organization_id
  INTO v_approver
  FROM public.employees e
  WHERE e.user_id = v_caller_uid;

  v_is_admin := (public.has_role(v_caller_uid, 'admin') OR public.is_superadmin(v_caller_uid));

  SELECT lr.*, e.manager_id AS req_manager_id
  INTO v_req
  FROM public.leave_requests lr
  JOIN public.employees e ON lr.employee_id = e.id
  WHERE lr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'Cannot reject request that is already %', v_req.status;
  END IF;

  IF NOT v_is_admin AND (v_approver.id IS NULL OR v_req.req_manager_id != v_approver.id) THEN
    RAISE EXCEPTION 'Unauthorized to reject this leave request';
  END IF;

  UPDATE public.leave_requests
  SET status = 'rejected',
      current_approval_level = 'completed',
      manager_id = CASE WHEN NOT v_is_admin THEN v_approver.id ELSE manager_id END,
      manager_comment = CASE WHEN NOT v_is_admin THEN trim(p_comment) ELSE manager_comment END,
      manager_decision = CASE WHEN NOT v_is_admin THEN 'rejected' ELSE manager_decision END,
      admin_id = CASE WHEN v_is_admin THEN v_approver.id ELSE admin_id END,
      admin_comment = CASE WHEN v_is_admin THEN trim(p_comment) ELSE admin_comment END,
      admin_decision = CASE WHEN v_is_admin THEN 'rejected' ELSE admin_decision END,
      decided_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'rejected',
    'message', 'Leave request has been rejected.'
  );
END;
$$;


-- D. Cancel Leave Transactional (With Balance Refund)
CREATE OR REPLACE FUNCTION public.cancel_leave_transactional(
  p_request_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_uid uuid;
  v_req record;
  v_is_admin boolean := false;
  v_emp record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_is_admin := (public.has_role(v_caller_uid, 'admin') OR public.is_superadmin(v_caller_uid));

  SELECT lr.*, e.user_id AS req_user_id, lt.is_paid
  INTO v_req
  FROM public.leave_requests lr
  JOIN public.employees e ON lr.employee_id = e.id
  JOIN public.leave_types lt ON lr.leave_type_id = lt.id
  WHERE lr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  IF v_req.status = 'cancelled' THEN
    RAISE EXCEPTION 'Request is already cancelled';
  END IF;

  IF v_req.status = 'rejected' THEN
    RAISE EXCEPTION 'Rejected requests cannot be cancelled';
  END IF;

  IF v_req.req_user_id != v_caller_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'You can only cancel your own leave requests';
  END IF;

  -- If request was already approved, atomically refund the balance!
  IF v_req.status = 'approved' AND v_req.is_paid THEN
    UPDATE public.leave_balances
    SET used = GREATEST(0, used - v_req.days),
        remaining = total - GREATEST(0, used - v_req.days)
    WHERE employee_id = v_req.employee_id
      AND leave_type_id = v_req.leave_type_id
      AND year = EXTRACT(YEAR FROM v_req.from_date)::integer;

    -- Remove attendance entries tied to this leave
    DELETE FROM public.attendance
    WHERE employee_id = v_req.employee_id
      AND date >= v_req.from_date
      AND date <= v_req.to_date
      AND method = 'leave';
  END IF;

  UPDATE public.leave_requests
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_by = v_caller_uid,
      cancellation_reason = trim(p_reason),
      current_approval_level = 'completed'
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'cancelled',
    'message', 'Leave request cancelled successfully. Any deducted balance has been restored.'
  );
END;
$$;


-- E. Annual Leave Allocation Function (With Carry-Forward)
CREATE OR REPLACE FUNCTION public.allocate_annual_leaves(
  p_year integer,
  p_employee_id uuid DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_emp record;
  v_lt record;
  v_prev_bal record;
  v_carried numeric := 0;
  v_allocated_count integer := 0;
BEGIN
  FOR v_emp IN
    SELECT id, organization_id
    FROM public.employees
    WHERE status = 'active'
      AND (p_employee_id IS NULL OR id = p_employee_id)
      AND (p_organization_id IS NULL OR organization_id = p_organization_id)
  LOOP
    FOR v_lt IN
      SELECT *
      FROM public.leave_types
      WHERE active = true
    LOOP
      v_carried := 0;

      -- Check if previous year balance exists for carry forward
      IF COALESCE(v_lt.allow_carry_forward, false) THEN
        SELECT (total - used) AS remaining INTO v_prev_bal
        FROM public.leave_balances
        WHERE employee_id = v_emp.id
          AND leave_type_id = v_lt.id
          AND year = p_year - 1;

        IF FOUND AND v_prev_bal.remaining > 0 THEN
          v_carried := LEAST(v_prev_bal.remaining, COALESCE(v_lt.max_carry_forward_days, 0));
        END IF;
      END IF;

      INSERT INTO public.leave_balances (
        employee_id,
        leave_type_id,
        year,
        total,
        used,
        carried_forward,
        organization_id
      ) VALUES (
        v_emp.id,
        v_lt.id,
        p_year,
        v_lt.days_per_year + v_carried,
        0,
        v_carried,
        COALESCE(v_emp.organization_id, p_organization_id)
      )
      ON CONFLICT (employee_id, leave_type_id, year) DO UPDATE
      SET total = v_lt.days_per_year + v_carried,
          carried_forward = v_carried;

      v_allocated_count := v_allocated_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'year', p_year,
    'allocated_records', v_allocated_count
  );
END;
$$;


-- 6. Grant Permissions to Authenticated Users
GRANT EXECUTE ON FUNCTION public.apply_leave_transactional(uuid, uuid, date, date, numeric, boolean, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_leave_transactional(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_leave_transactional(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_leave_transactional(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_annual_leaves(integer, uuid, uuid) TO authenticated;

-- Enable RLS on leave_policies
ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated to view active leave policies"
ON public.leave_policies FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin to manage leave policies"
ON public.leave_policies FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())
);
