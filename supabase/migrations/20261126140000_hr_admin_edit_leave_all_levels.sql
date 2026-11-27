-- ==============================================================================
-- FlowPeople: Allow HR (hr_manager) & Admin to edit leaves at all levels/statuses
-- and adjust employee leave balances safely & transactionally.
-- ==============================================================================

-- 1. Unified HR / Admin authorization helper (scoped to organization when given)
CREATE OR REPLACE FUNCTION public.is_hr_or_admin(p_org_id uuid DEFAULT NULL)
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
      )
      OR EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = (SELECT auth.uid())
          AND om.status = 'active'
          AND om.role IN ('super_admin', 'org_admin', 'hr_manager')
          AND (p_org_id IS NULL OR om.organization_id = p_org_id)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_hr_or_admin(uuid) TO authenticated;

-- 2. Upgrade RLS on leave tables so both HR (hr_manager) & Admin have full org-scoped access
DROP POLICY IF EXISTS "leave_requests_admin_all_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_admin_all_policy" ON public.leave_requests
  FOR ALL TO authenticated
  USING (
    public.is_hr_or_admin(organization_id)
    OR (
      public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      AND (public.is_my_team_member(employee_id) OR employee_id = public.current_employee_id())
    )
  )
  WITH CHECK (
    public.is_hr_or_admin(organization_id)
    OR (
      public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      AND (public.is_my_team_member(employee_id) OR employee_id = public.current_employee_id())
    )
  );

DROP POLICY IF EXISTS "leave_balances_admin_all_policy" ON public.leave_balances;
CREATE POLICY "leave_balances_admin_all_policy" ON public.leave_balances
  FOR ALL TO authenticated
  USING (
    public.is_hr_or_admin(organization_id)
    OR (
      public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      AND (public.is_my_team_member(employee_id) OR employee_id = public.current_employee_id())
    )
  )
  WITH CHECK (
    public.is_hr_or_admin(organization_id)
  );

DROP POLICY IF EXISTS "Allow admin to manage leave policies" ON public.leave_policies;
CREATE POLICY "Allow admin to manage leave policies"
ON public.leave_policies FOR ALL
TO authenticated
USING (public.is_hr_or_admin(organization_id))
WITH CHECK (public.is_hr_or_admin(organization_id));

DROP POLICY IF EXISTS "leave_types_hr_admin_all" ON public.leave_types;
CREATE POLICY "leave_types_hr_admin_all"
ON public.leave_types FOR ALL
TO authenticated
USING (public.is_hr_or_admin(organization_id))
WITH CHECK (public.is_hr_or_admin(organization_id));

-- 3. Update existing leave RPCs so HR (hr_manager) has the same HR/Admin authority as Admin
CREATE OR REPLACE FUNCTION public.apply_leave_transactional(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_from_date date,
  p_to_date date,
  p_days numeric,
  p_half_day boolean DEFAULT false,
  p_half_day_period text DEFAULT 'full_day'::text,
  p_reason text DEFAULT NULL::text,
  p_attachment_url text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
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

  SELECT e.id, e.user_id, e.manager_id, e.organization_id, e.full_name
  INTO v_emp
  FROM public.employees e
  WHERE e.id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee profile not found';
  END IF;

  IF v_emp.user_id != v_caller_uid AND NOT public.is_hr_or_admin(v_emp.organization_id) THEN
    RAISE EXCEPTION 'You are not authorized to submit leave for another employee';
  END IF;

  IF p_to_date < p_from_date THEN
    RAISE EXCEPTION 'End date cannot be earlier than start date';
  END IF;

  IF p_days <= 0 THEN
    RAISE EXCEPTION 'Calculated leave duration must be greater than zero working days';
  END IF;

  SELECT COUNT(*) INTO v_overlap_count
  FROM public.leave_requests lr
  WHERE lr.employee_id = p_employee_id
    AND lr.status IN ('pending', 'approved')
    AND lr.from_date <= p_to_date
    AND lr.to_date >= p_from_date;

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'An overlapping leave request already exists for this date range';
  END IF;

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
      INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total, used, carried_forward, organization_id)
      VALUES (p_employee_id, p_leave_type_id, v_req_year, v_leave_type.days_per_year, 0, 0, v_emp.organization_id)
      ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
    END IF;
  END IF;

  IF v_emp.manager_id IS NOT NULL AND v_emp.manager_id != p_employee_id THEN
    v_manager_id := v_emp.manager_id;
    v_approval_level := 'manager';
  ELSE
    v_manager_id := NULL;
    v_approval_level := 'admin';
  END IF;

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
    'request_id', v_new_req_id,
    'approval_level', v_approval_level,
    'days', p_days
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_leave_transactional(
  p_request_id uuid,
  p_comment text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_caller_uid uuid;
  v_approver record;
  v_is_admin boolean := false;
  v_req record;
  v_policy record;
  v_cur_date date;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT e.id, e.full_name, e.department_id, e.organization_id
  INTO v_approver
  FROM public.employees e
  WHERE e.user_id = v_caller_uid;

  SELECT lr.*, e.user_id AS req_user_id, e.manager_id AS req_manager_id, e.organization_id AS emp_org_id,
         lt.name AS leave_type_name, lt.is_paid
  INTO v_req
  FROM public.leave_requests lr
  JOIN public.employees e ON lr.employee_id = e.id
  JOIN public.leave_types lt ON lr.leave_type_id = lt.id
  WHERE lr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  v_is_admin := public.is_hr_or_admin(COALESCE(v_req.organization_id, v_req.emp_org_id));

  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'Leave request has already been % and cannot be approved again', v_req.status;
  END IF;

  SELECT * INTO v_policy
  FROM public.leave_policies
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_req.current_approval_level = 'manager' THEN
    IF NOT v_is_admin AND (v_approver.id IS NULL OR v_req.req_manager_id != v_approver.id) THEN
      RAISE EXCEPTION 'Only the assigned reporting manager or an HR Administrator can approve this step';
    END IF;

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

  IF v_req.current_approval_level = 'admin' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Final approval requires HR Administrator authority';
  END IF;

  PERFORM set_config('app.leave_tx_handled', 'true', true);

  UPDATE public.leave_requests
  SET status = 'approved',
      current_approval_level = 'completed',
      admin_id = COALESCE(v_approver.id, v_req.admin_id),
      admin_comment = CASE WHEN v_is_admin THEN trim(p_comment) ELSE v_req.admin_comment END,
      admin_decision = 'approved',
      admin_decision_at = NOW(),
      decided_at = NOW()
  WHERE id = p_request_id;

  IF v_req.is_paid THEN
    UPDATE public.leave_balances
    SET used = used + v_req.days
    WHERE employee_id = v_req.employee_id
      AND leave_type_id = v_req.leave_type_id
      AND year = EXTRACT(YEAR FROM v_req.from_date)::integer;
  END IF;

  v_cur_date := v_req.from_date;
  WHILE v_cur_date <= v_req.to_date LOOP
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
      COALESCE(v_req.organization_id, v_req.emp_org_id)
    )
    ON CONFLICT (employee_id, date) DO UPDATE
    SET status = 'on_leave',
        method = 'leave',
        note = 'Approved ' || v_req.leave_type_name,
        is_half_day = v_req.half_day;

    v_cur_date := v_cur_date + 1;
  END LOOP;

  PERFORM set_config('app.leave_tx_handled', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'status', 'approved',
    'current_approval_level', 'completed',
    'message', 'Leave request fully approved. Balance ledger and attendance synchronized.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_leave_transactional(
  p_request_id uuid,
  p_comment text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
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

  SELECT lr.*, e.manager_id AS req_manager_id, e.organization_id AS emp_org_id
  INTO v_req
  FROM public.leave_requests lr
  JOIN public.employees e ON lr.employee_id = e.id
  WHERE lr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  v_is_admin := public.is_hr_or_admin(COALESCE(v_req.organization_id, v_req.emp_org_id));

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
$function$;

CREATE OR REPLACE FUNCTION public.cancel_leave_transactional(
  p_request_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_caller_uid uuid;
  v_req record;
  v_is_admin boolean := false;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lr.*, e.user_id AS req_user_id, e.organization_id AS emp_org_id, lt.is_paid
  INTO v_req
  FROM public.leave_requests lr
  JOIN public.employees e ON lr.employee_id = e.id
  JOIN public.leave_types lt ON lr.leave_type_id = lt.id
  WHERE lr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  v_is_admin := public.is_hr_or_admin(COALESCE(v_req.organization_id, v_req.emp_org_id));

  IF v_req.status = 'cancelled' THEN
    RAISE EXCEPTION 'Request is already cancelled';
  END IF;

  IF v_req.status = 'rejected' THEN
    RAISE EXCEPTION 'Rejected requests cannot be cancelled';
  END IF;

  IF v_req.req_user_id != v_caller_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'You can only cancel your own leave requests';
  END IF;

  PERFORM set_config('app.leave_tx_handled', 'true', true);

  IF v_req.status = 'approved' AND v_req.is_paid THEN
    UPDATE public.leave_balances
    SET used = GREATEST(0, used - v_req.days)
    WHERE employee_id = v_req.employee_id
      AND leave_type_id = v_req.leave_type_id
      AND year = EXTRACT(YEAR FROM v_req.from_date)::integer;

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

  PERFORM set_config('app.leave_tx_handled', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'status', 'cancelled',
    'message', 'Leave request cancelled successfully. Any deducted balance has been restored.'
  );
END;
$function$;

-- 4. New RPC: HR & Admin Edit Leave Request at Any Approval Level / Status
CREATE OR REPLACE FUNCTION public.edit_leave_request_transactional(
  p_request_id uuid,
  p_leave_type_id uuid,
  p_from_date date,
  p_to_date date,
  p_days numeric,
  p_half_day boolean DEFAULT false,
  p_half_day_period text DEFAULT 'full_day'::text,
  p_reason text DEFAULT NULL::text,
  p_status public.leave_status DEFAULT NULL,
  p_current_approval_level text DEFAULT NULL::text,
  p_manager_comment text DEFAULT NULL::text,
  p_admin_comment text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_caller_uid uuid;
  v_editor_emp_id uuid;
  v_req record;
  v_new_lt record;
  v_org_id uuid;
  v_new_status public.leave_status;
  v_new_level text;
  v_overlap_count integer;
  v_new_year integer;
  v_cur_date date;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lr.*, e.manager_id AS emp_manager_id, e.organization_id AS emp_org_id,
         lt.is_paid AS old_is_paid
  INTO v_req
  FROM public.leave_requests lr
  JOIN public.employees e ON lr.employee_id = e.id
  JOIN public.leave_types lt ON lr.leave_type_id = lt.id
  WHERE lr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  v_org_id := COALESCE(v_req.organization_id, v_req.emp_org_id);
  IF NOT public.is_hr_or_admin(v_org_id) THEN
    RAISE EXCEPTION 'Forbidden: only HR or Admin can edit leave requests' USING ERRCODE = '42501';
  END IF;

  IF p_to_date < p_from_date THEN
    RAISE EXCEPTION 'End date cannot be earlier than start date';
  END IF;

  IF p_days IS NULL OR p_days <= 0 THEN
    RAISE EXCEPTION 'Leave days must be greater than zero';
  END IF;

  SELECT * INTO v_new_lt
  FROM public.leave_types
  WHERE id = p_leave_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid leave type selected';
  END IF;

  IF p_half_day AND NOT COALESCE(v_new_lt.allow_half_day, true) THEN
    RAISE EXCEPTION 'Half-day is not permitted for %', v_new_lt.name;
  END IF;

  v_new_status := COALESCE(p_status, v_req.status);

  IF p_current_approval_level IS NOT NULL AND p_current_approval_level NOT IN ('manager', 'admin', 'completed') THEN
    RAISE EXCEPTION 'Invalid approval level: %', p_current_approval_level;
  END IF;

  IF v_new_status IN ('pending', 'approved') THEN
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.leave_requests lr
    WHERE lr.employee_id = v_req.employee_id
      AND lr.id <> p_request_id
      AND lr.status IN ('pending', 'approved')
      AND lr.from_date <= p_to_date
      AND lr.to_date >= p_from_date;

    IF v_overlap_count > 0 THEN
      RAISE EXCEPTION 'Updated dates overlap with another pending or approved leave request';
    END IF;
  END IF;

  SELECT id INTO v_editor_emp_id
  FROM public.employees
  WHERE user_id = v_caller_uid
  LIMIT 1;

  PERFORM set_config('app.leave_tx_handled', 'true', true);

  -- Refund previous balance & remove old leave attendance if previously approved
  IF v_req.status = 'approved' THEN
    IF v_req.old_is_paid THEN
      UPDATE public.leave_balances
      SET used = GREATEST(0, used - v_req.days)
      WHERE employee_id = v_req.employee_id
        AND leave_type_id = v_req.leave_type_id
        AND year = EXTRACT(YEAR FROM v_req.from_date)::integer;
    END IF;

    DELETE FROM public.attendance
    WHERE employee_id = v_req.employee_id
      AND date >= v_req.from_date
      AND date <= v_req.to_date
      AND method = 'leave';
  END IF;

  IF v_new_status = 'pending' THEN
    v_new_level := COALESCE(
      NULLIF(p_current_approval_level, ''),
      CASE
        WHEN v_req.emp_manager_id IS NOT NULL AND v_req.emp_manager_id <> v_req.employee_id THEN 'manager'
        ELSE 'admin'
      END
    );
  ELSE
    v_new_level := 'completed';
  END IF;

  UPDATE public.leave_requests
  SET leave_type_id = p_leave_type_id,
      from_date = p_from_date,
      to_date = p_to_date,
      days = p_days,
      half_day = COALESCE(p_half_day, false),
      half_day_period = CASE
        WHEN COALESCE(p_half_day, false) THEN COALESCE(NULLIF(p_half_day_period, ''), 'first_half')
        ELSE 'full_day'
      END,
      reason = NULLIF(trim(p_reason), ''),
      status = v_new_status,
      current_approval_level = v_new_level,
      manager_comment = NULLIF(trim(p_manager_comment), ''),
      admin_comment = NULLIF(trim(p_admin_comment), ''),
      admin_id = CASE
        WHEN v_new_status IN ('approved', 'rejected') THEN COALESCE(v_editor_emp_id, v_req.admin_id)
        ELSE v_req.admin_id
      END,
      manager_decision = CASE
        WHEN v_new_status = 'pending' AND v_new_level = 'manager' THEN 'pending'
        WHEN v_new_status = 'pending' AND v_new_level = 'admin' THEN 'approved'
        ELSE v_req.manager_decision
      END,
      manager_decision_at = CASE
        WHEN v_new_status = 'pending' AND v_new_level = 'manager' THEN NULL
        WHEN v_new_status = 'pending' AND v_new_level = 'admin' THEN COALESCE(v_req.manager_decision_at, NOW())
        ELSE v_req.manager_decision_at
      END,
      admin_decision = CASE
        WHEN v_new_status = 'approved' THEN 'approved'
        WHEN v_new_status = 'rejected' THEN 'rejected'
        WHEN v_new_status = 'pending' THEN 'pending'
        ELSE v_req.admin_decision
      END,
      admin_decision_at = CASE
        WHEN v_new_status IN ('approved', 'rejected') THEN NOW()
        WHEN v_new_status = 'pending' THEN NULL
        ELSE v_req.admin_decision_at
      END,
      decided_at = CASE
        WHEN v_new_status IN ('approved', 'rejected') THEN NOW()
        ELSE NULL
      END,
      cancelled_at = CASE
        WHEN v_new_status = 'cancelled' THEN COALESCE(v_req.cancelled_at, NOW())
        ELSE NULL
      END,
      cancelled_by = CASE
        WHEN v_new_status = 'cancelled' THEN COALESCE(v_req.cancelled_by, v_caller_uid)
        ELSE NULL
      END,
      cancellation_reason = CASE
        WHEN v_new_status = 'cancelled' THEN COALESCE(NULLIF(trim(p_admin_comment), ''), v_req.cancellation_reason)
        ELSE NULL
      END
  WHERE id = p_request_id;

  -- Deduct new balance & sync attendance if resulting status is approved
  IF v_new_status = 'approved' THEN
    v_new_year := EXTRACT(YEAR FROM p_from_date)::integer;

    IF v_new_lt.is_paid THEN
      INSERT INTO public.leave_balances (
        employee_id, leave_type_id, year, total, used, carried_forward, organization_id
      ) VALUES (
        v_req.employee_id, p_leave_type_id, v_new_year, v_new_lt.days_per_year, 0, 0, v_org_id
      )
      ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

      UPDATE public.leave_balances
      SET used = used + p_days
      WHERE employee_id = v_req.employee_id
        AND leave_type_id = p_leave_type_id
        AND year = v_new_year;
    END IF;

    v_cur_date := p_from_date;
    WHILE v_cur_date <= p_to_date LOOP
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
        'Approved ' || v_new_lt.name,
        COALESCE(p_half_day, false),
        v_org_id
      )
      ON CONFLICT (employee_id, date) DO UPDATE
      SET status = 'on_leave',
          method = 'leave',
          note = 'Approved ' || v_new_lt.name,
          is_half_day = COALESCE(p_half_day, false),
          organization_id = COALESCE(EXCLUDED.organization_id, public.attendance.organization_id);

      v_cur_date := v_cur_date + 1;
    END LOOP;
  END IF;

  PERFORM set_config('app.leave_tx_handled', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'leave_request_id', p_request_id,
    'status', v_new_status,
    'current_approval_level', v_new_level,
    'days', p_days
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.edit_leave_request_transactional(
  uuid, uuid, date, date, numeric, boolean, text, text, public.leave_status, text, text, text
) TO authenticated;

-- 5. New RPC: HR & Admin Direct Leave Balance Adjustment
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
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_emp record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, organization_id INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  IF NOT public.is_hr_or_admin(v_emp.organization_id) THEN
    RAISE EXCEPTION 'Forbidden: only HR or Admin can edit leave balances' USING ERRCODE = '42501';
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

  RETURN jsonb_build_object(
    'success', true,
    'employee_id', p_employee_id,
    'leave_type_id', p_leave_type_id,
    'year', p_year,
    'total', p_total,
    'used', p_used,
    'remaining', p_total - p_used
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_leave_balance(uuid, uuid, integer, numeric, numeric, numeric) TO authenticated;

-- 6. Only enforce leave overlap when target status is active (pending or approved)
CREATE OR REPLACE FUNCTION public.block_overlapping_leave()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status IN ('pending'::public.leave_status, 'approved'::public.leave_status) THEN
    IF EXISTS (
      SELECT 1
      FROM public.leave_requests
      WHERE employee_id = NEW.employee_id
        AND status IN ('pending'::public.leave_status, 'approved'::public.leave_status)
        AND id <> COALESCE(NEW.id, gen_random_uuid())
        AND daterange(from_date, to_date, '[]') && daterange(NEW.from_date, NEW.to_date, '[]')
    ) THEN
      RAISE EXCEPTION 'Leave dates overlap with another request';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
