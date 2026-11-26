-- Fix broken live Postgres RPC functions, generated-column updates, double leave deductions,
-- search_path hygiene, view security_invoker, and broken RLS policies.

-- 1. Fix verify_employee_document: public.documents does not have an updated_at column.
CREATE OR REPLACE FUNCTION public.verify_employee_document(
  p_document_id uuid,
  p_status text,
  p_rejection_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc record;
  v_reviewer_emp_id uuid;
BEGIN
  SELECT * INTO v_doc FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  SELECT id INTO v_reviewer_emp_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;

  UPDATE public.documents
  SET verification_status = p_status,
      verified_by = v_reviewer_emp_id,
      verified_at = CASE WHEN p_status = 'verified' THEN now() ELSE NULL END,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END
  WHERE id = p_document_id;

  UPDATE public.employee_onboarding_tasks
  SET status = CASE WHEN p_status = 'verified' THEN 'verified' ELSE 'rejected' END,
      rejection_notes = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
      completed_at = CASE WHEN p_status = 'verified' THEN now() ELSE completed_at END
  WHERE document_id = p_document_id;

  PERFORM public.recalculate_onboarding_progress(onboarding_id)
  FROM public.employee_onboarding_tasks
  WHERE document_id = p_document_id;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', p_document_id,
    'status', p_status
  );
END;
$function$;

-- 2. Fix convert_candidate_to_employee: pass (year, employee_id, org_id) in allocate_annual_leaves signature order.
CREATE OR REPLACE FUNCTION public.convert_candidate_to_employee(
  p_candidate_id uuid,
  p_employee_code text,
  p_joining_date date,
  p_designation text DEFAULT NULL::text,
  p_department_id uuid DEFAULT NULL::uuid,
  p_manager_id uuid DEFAULT NULL::uuid,
  p_employment_type text DEFAULT 'full_time'::text,
  p_shift_id uuid DEFAULT NULL::uuid,
  p_start_onboarding boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_cand record;
  v_existing_emp_id uuid;
  v_new_emp_id uuid;
  v_user_id uuid;
  v_org_id uuid;
  v_doc_record record;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_cand
  FROM public.candidates
  WHERE id = p_candidate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found: %', p_candidate_id;
  END IF;

  SELECT id INTO v_existing_emp_id
  FROM public.employees
  WHERE LOWER(email) = LOWER(v_cand.email)
  LIMIT 1;

  IF v_existing_emp_id IS NOT NULL THEN
    v_new_emp_id := v_existing_emp_id;

    UPDATE public.employees
    SET
      designation = COALESCE(p_designation, designation),
      department_id = COALESCE(p_department_id, department_id),
      manager_id = COALESCE(p_manager_id, manager_id),
      status = 'active',
      joining_date = COALESCE(p_joining_date, joining_date, CURRENT_DATE),
      employment_type = COALESCE(p_employment_type, employment_type),
      shift_id = COALESCE(p_shift_id, shift_id),
      updated_at = now()
    WHERE id = v_existing_emp_id;

    v_org_id := COALESCE(
      v_cand.organization_id,
      (SELECT organization_id FROM public.employees WHERE id = v_existing_emp_id)
    );
  ELSE
    v_org_id := v_cand.organization_id;

    INSERT INTO public.employees (
      organization_id,
      employee_code,
      full_name,
      email,
      phone,
      department_id,
      designation,
      manager_id,
      joining_date,
      employment_type,
      shift_id,
      status,
      onboarding_status
    ) VALUES (
      v_org_id,
      p_employee_code,
      v_cand.full_name,
      v_cand.email,
      v_cand.phone,
      p_department_id,
      COALESCE(p_designation, v_cand.current_designation, 'New Hire'),
      p_manager_id,
      COALESCE(p_joining_date, CURRENT_DATE),
      COALESCE(p_employment_type, 'full_time'),
      p_shift_id,
      'active',
      CASE WHEN p_start_onboarding THEN 'in_progress' ELSE 'completed' END
    )
    RETURNING id INTO v_new_emp_id;
  END IF;

  IF v_cand.resume_url IS NOT NULL THEN
    INSERT INTO public.documents (
      organization_id,
      employee_id,
      title,
      category,
      document_type,
      file_url,
      file_name,
      verification_status,
      uploaded_by
    ) VALUES (
      v_cand.organization_id,
      v_new_emp_id,
      'Resume - ' || v_cand.full_name,
      'Personal Document',
      'Resume',
      v_cand.resume_url,
      v_cand.resume_file_name,
      'verified',
      v_user_id
    );
  END IF;

  FOR v_doc_record IN
    SELECT * FROM public.candidate_documents WHERE candidate_id = p_candidate_id
  LOOP
    INSERT INTO public.documents (
      organization_id,
      employee_id,
      title,
      category,
      file_url,
      file_name,
      file_size,
      verification_status,
      uploaded_by
    ) VALUES (
      v_cand.organization_id,
      v_new_emp_id,
      v_doc_record.title,
      'Personal Document',
      v_doc_record.file_url,
      v_doc_record.file_name,
      v_doc_record.file_size,
      'verified',
      v_user_id
    );
  END LOOP;

  UPDATE public.candidates
  SET
    stage = 'hired',
    offer_status = 'accepted',
    converted_employee_id = v_new_emp_id,
    joining_date = COALESCE(p_joining_date, joining_date, CURRENT_DATE),
    updated_at = now()
  WHERE id = p_candidate_id;

  IF p_start_onboarding THEN
    PERFORM public.start_employee_onboarding(v_new_emp_id, NULL, (COALESCE(p_joining_date, CURRENT_DATE) + 14));
  END IF;

  PERFORM public.allocate_annual_leaves(
    EXTRACT(YEAR FROM CURRENT_DATE)::integer,
    v_new_emp_id,
    v_org_id
  );

  INSERT INTO public.candidate_activities (
    candidate_id,
    performed_by,
    action,
    to_stage,
    notes
  ) VALUES (
    p_candidate_id,
    v_user_id,
    'converted_to_employee',
    'hired',
    'Candidate converted to employee roster (' || p_employee_code || ')'
  );

  RETURN v_new_emp_id;
END;
$function$;

-- 3. Fix approve_attendance_correction: remove invalid ::text casts into date/timestamptz columns and upsert on (employee_id, date).
CREATE OR REPLACE FUNCTION public.approve_attendance_correction(
  p_correction_id uuid,
  p_admin_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corr record;
  v_emp record;
  v_shift_id uuid;
  v_in_ts timestamptz;
  v_out_ts timestamptz;
  v_metrics jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Only administrators or managers can approve correction requests.';
  END IF;

  SELECT * INTO v_corr FROM public.attendance_corrections WHERE id = p_correction_id;
  IF v_corr.id IS NULL THEN
    RAISE EXCEPTION 'Correction request not found.';
  END IF;

  IF v_corr.status <> 'pending' THEN
    RAISE EXCEPTION 'This correction request is already %', v_corr.status;
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = v_corr.employee_id;
  v_shift_id := v_emp.shift_id;

  IF v_corr.requested_check_in IS NOT NULL THEN
    v_in_ts := (v_corr.date::text || ' ' || v_corr.requested_check_in::text)::timestamptz;
  END IF;

  IF v_corr.requested_check_out IS NOT NULL THEN
    v_out_ts := (v_corr.date::text || ' ' || v_corr.requested_check_out::text)::timestamptz;
  END IF;

  v_metrics := public.calculate_attendance_metrics(v_in_ts, v_out_ts, v_shift_id);

  IF v_corr.attendance_id IS NOT NULL THEN
    UPDATE public.attendance
    SET check_in = COALESCE(v_in_ts, check_in),
        check_out = COALESCE(v_out_ts, check_out),
        shift_id = COALESCE(v_shift_id, shift_id),
        working_hours = (v_metrics->>'working_hours')::numeric,
        overtime_hours = (v_metrics->>'overtime_hours')::numeric,
        is_late = (v_metrics->>'is_late')::boolean,
        late_minutes = (v_metrics->>'late_minutes')::integer,
        is_early_departure = (v_metrics->>'is_early_departure')::boolean,
        early_departure_minutes = (v_metrics->>'early_departure_minutes')::integer,
        status = (v_metrics->>'status')::public.attendance_status,
        note = 'Corrected by HR approval (' || COALESCE(p_admin_notes, 'Approved') || ')'
    WHERE id = v_corr.attendance_id;
  ELSE
    INSERT INTO public.attendance (
      employee_id,
      organization_id,
      date,
      check_in,
      check_out,
      shift_id,
      method,
      status,
      working_hours,
      overtime_hours,
      is_late,
      late_minutes,
      is_early_departure,
      early_departure_minutes,
      note
    ) VALUES (
      v_corr.employee_id,
      COALESCE(v_corr.organization_id, v_emp.organization_id),
      v_corr.date,
      v_in_ts,
      v_out_ts,
      v_shift_id,
      'manual',
      (v_metrics->>'status')::public.attendance_status,
      (v_metrics->>'working_hours')::numeric,
      (v_metrics->>'overtime_hours')::numeric,
      (v_metrics->>'is_late')::boolean,
      (v_metrics->>'late_minutes')::integer,
      (v_metrics->>'is_early_departure')::boolean,
      (v_metrics->>'early_departure_minutes')::integer,
      'Added by HR correction approval (' || COALESCE(p_admin_notes, 'Approved') || ')'
    )
    ON CONFLICT (employee_id, date) DO UPDATE SET
      check_in = COALESCE(EXCLUDED.check_in, public.attendance.check_in),
      check_out = COALESCE(EXCLUDED.check_out, public.attendance.check_out),
      shift_id = COALESCE(EXCLUDED.shift_id, public.attendance.shift_id),
      working_hours = EXCLUDED.working_hours,
      overtime_hours = EXCLUDED.overtime_hours,
      is_late = EXCLUDED.is_late,
      late_minutes = EXCLUDED.late_minutes,
      is_early_departure = EXCLUDED.is_early_departure,
      early_departure_minutes = EXCLUDED.early_departure_minutes,
      status = EXCLUDED.status,
      note = EXCLUDED.note;
  END IF;

  UPDATE public.attendance_corrections
  SET status = 'approved',
      decided_by = auth.uid(),
      admin_notes = p_admin_notes,
      decided_at = now()
  WHERE id = p_correction_id;

  RETURN jsonb_build_object('success', true, 'correction_id', p_correction_id);
END;
$function$;

-- 4. Fix leave RPCs:
--    a) apply_leave_transactional returns both leave_request_id and request_id
--    b) approve_leave_transactional & cancel_leave_transactional do NOT update generated column leave_balances.remaining
--       and guard handle_leave_status_change() via app.leave_tx_handled so balances aren't deducted/refunded twice.
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

CREATE OR REPLACE FUNCTION public.handle_leave_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d date;
  v_org_id uuid;
BEGIN
  IF COALESCE(current_setting('app.leave_tx_handled', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO v_org_id FROM public.employees WHERE id = NEW.employee_id;
  v_org_id := COALESCE(NEW.organization_id, v_org_id);

  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    UPDATE public.leave_balances
    SET used = used + NEW.days
    WHERE employee_id = NEW.employee_id
      AND leave_type_id = NEW.leave_type_id
      AND year = EXTRACT(YEAR FROM NEW.from_date)::int;

    FOR d IN SELECT generate_series(NEW.from_date, NEW.to_date, interval '1 day')::date LOOP
      INSERT INTO public.attendance (employee_id, date, status, method, organization_id)
      VALUES (NEW.employee_id, d, 'on_leave', 'leave', v_org_id)
      ON CONFLICT (employee_id, date) DO UPDATE
        SET status = 'on_leave', method = 'leave', organization_id = EXCLUDED.organization_id;
    END LOOP;

  ELSIF OLD.status = 'approved' AND NEW.status IN ('cancelled', 'rejected') THEN
    UPDATE public.leave_balances
    SET used = GREATEST(used - NEW.days, 0)
    WHERE employee_id = NEW.employee_id
      AND leave_type_id = NEW.leave_type_id
      AND year = EXTRACT(YEAR FROM NEW.from_date)::int;

    DELETE FROM public.attendance
    WHERE employee_id = NEW.employee_id
      AND status = 'on_leave'
      AND date BETWEEN NEW.from_date AND NEW.to_date;
  END IF;

  RETURN NEW;
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

  v_is_admin := (public.has_role(v_caller_uid, 'admin') OR public.is_superadmin(v_caller_uid));

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
      v_req.organization_id
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

-- 5. Security hardening: search_path on SECURITY DEFINER trigger & security_invoker on people view.
ALTER FUNCTION public.log_employee_profile_update() SET search_path = public, auth;
ALTER VIEW public.people SET (security_invoker = true);

-- 6. Fix invalid organization_members.role strings ('admin','manager' -> valid check values) and add WITH CHECK on UPDATE policies.
DROP POLICY IF EXISTS "Admins can update suggestions" ON public.employee_suggestions;
CREATE POLICY "Admins can update suggestions"
ON public.employee_suggestions
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND (
        om.role = ANY (ARRAY['super_admin'::text, 'org_admin'::text, 'hr_manager'::text])
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      )
  )
)
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND (
        om.role = ANY (ARRAY['super_admin'::text, 'org_admin'::text, 'hr_manager'::text])
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      )
  )
);

DROP POLICY IF EXISTS "Admins and managers can manage questions" ON public.engagement_questions;
CREATE POLICY "Admins and managers can manage questions"
ON public.engagement_questions
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND (
        om.role = ANY (ARRAY['super_admin'::text, 'org_admin'::text, 'hr_manager'::text])
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      )
  )
)
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND (
        om.role = ANY (ARRAY['super_admin'::text, 'org_admin'::text, 'hr_manager'::text])
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      )
  )
);

DROP POLICY IF EXISTS "Admins and managers can manage surveys" ON public.engagement_surveys;
CREATE POLICY "Admins and managers can manage surveys"
ON public.engagement_surveys
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND (
        om.role = ANY (ARRAY['super_admin'::text, 'org_admin'::text, 'hr_manager'::text])
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      )
  )
)
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND (
        om.role = ANY (ARRAY['super_admin'::text, 'org_admin'::text, 'hr_manager'::text])
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      )
  )
);

DROP POLICY IF EXISTS "employee_onboarding_update" ON public.employee_onboarding;
CREATE POLICY "employee_onboarding_update"
ON public.employee_onboarding
FOR UPDATE
TO authenticated
USING (
  (employee_id IN (SELECT employees.id FROM public.employees WHERE employees.user_id = (SELECT auth.uid())))
  OR (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])))
)
WITH CHECK (
  (employee_id IN (SELECT employees.id FROM public.employees WHERE employees.user_id = (SELECT auth.uid())))
  OR (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])))
);

DROP POLICY IF EXISTS "employee_onboarding_tasks_update" ON public.employee_onboarding_tasks;
CREATE POLICY "employee_onboarding_tasks_update"
ON public.employee_onboarding_tasks
FOR UPDATE
TO authenticated
USING (
  (employee_id IN (SELECT employees.id FROM public.employees WHERE employees.user_id = (SELECT auth.uid())))
  OR (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])))
)
WITH CHECK (
  (employee_id IN (SELECT employees.id FROM public.employees WHERE employees.user_id = (SELECT auth.uid())))
  OR (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])))
);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
