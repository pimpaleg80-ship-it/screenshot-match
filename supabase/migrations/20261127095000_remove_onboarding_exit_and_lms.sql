-- Permanently remove Onboarding, Onboarding Checklists, Offboarding/Exit, and Learning/LMS modules
-- Includes dropping 10 RPC/helper functions, 19 tables, 4 columns on remaining tables,
-- and updating the 4 remaining functions that referenced them.

-- 1. Drop obsolete functions (onboarding, offboarding/exit, and LMS)
DROP FUNCTION IF EXISTS public.complete_employee_onboarding(uuid, text);
DROP FUNCTION IF EXISTS public.start_employee_onboarding(uuid, uuid, date);
DROP FUNCTION IF EXISTS public.recalculate_onboarding_progress(uuid);
DROP FUNCTION IF EXISTS public.submit_onboarding_task(uuid, uuid, text);

DROP FUNCTION IF EXISTS public.submit_employee_resignation(uuid, date, text, text);
DROP FUNCTION IF EXISTS public.review_employee_resignation(uuid, uuid, text, date, integer, text);
DROP FUNCTION IF EXISTS public.finalize_employee_exit(uuid, uuid, text);

DROP FUNCTION IF EXISTS public.assign_course_to_employees(uuid, uuid[], date);
DROP FUNCTION IF EXISTS public.complete_lesson_module(uuid, uuid);
DROP FUNCTION IF EXISTS public.submit_quiz_assessment(uuid, uuid, jsonb);

-- 2. Drop all Offboarding/Exit, Onboarding, and LMS tables permanently
DROP TABLE IF EXISTS public.exit_history CASCADE;
DROP TABLE IF EXISTS public.exit_fnf_settlements CASCADE;
DROP TABLE IF EXISTS public.exit_interviews CASCADE;
DROP TABLE IF EXISTS public.exit_clearances CASCADE;
DROP TABLE IF EXISTS public.exit_asset_returns CASCADE;
DROP TABLE IF EXISTS public.exit_kt_tasks CASCADE;
DROP TABLE IF EXISTS public.employee_exits CASCADE;

DROP TABLE IF EXISTS public.employee_onboarding_tasks CASCADE;
DROP TABLE IF EXISTS public.employee_onboarding CASCADE;
DROP TABLE IF EXISTS public.onboarding_checklist_items CASCADE;
DROP TABLE IF EXISTS public.onboarding_templates CASCADE;

DROP TABLE IF EXISTS public.lms_certificates CASCADE;
DROP TABLE IF EXISTS public.lms_quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.lms_quiz_questions CASCADE;
DROP TABLE IF EXISTS public.lms_quizzes CASCADE;
DROP TABLE IF EXISTS public.lms_lesson_progress CASCADE;
DROP TABLE IF EXISTS public.lms_course_enrollments CASCADE;
DROP TABLE IF EXISTS public.lms_modules CASCADE;
DROP TABLE IF EXISTS public.lms_courses CASCADE;

-- 3. Drop onboarding / exit columns from remaining tables
ALTER TABLE public.employees
  DROP COLUMN IF EXISTS onboarding_status,
  DROP COLUMN IF EXISTS exit_status,
  DROP COLUMN IF EXISTS resignation_date;

ALTER TABLE public.notification_preferences
  DROP COLUMN IF EXISTS notify_onboarding;

-- 4. Update remaining functions that referenced removed tables/columns

-- 4a. convert_candidate_to_employee (remove p_start_onboarding & onboarding calls)
DROP FUNCTION IF EXISTS public.convert_candidate_to_employee(uuid, text, date, text, uuid, uuid, text, uuid, boolean);

CREATE OR REPLACE FUNCTION public.convert_candidate_to_employee(
  p_candidate_id uuid,
  p_employee_code text,
  p_joining_date date,
  p_designation text DEFAULT NULL::text,
  p_department_id uuid DEFAULT NULL::uuid,
  p_manager_id uuid DEFAULT NULL::uuid,
  p_employment_type text DEFAULT 'full_time'::text,
  p_shift_id uuid DEFAULT NULL::uuid
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
      status
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
      'active'
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

GRANT EXECUTE ON FUNCTION public.convert_candidate_to_employee(uuid, text, date, text, uuid, uuid, text, uuid) TO authenticated, service_role;

-- 4b. verify_employee_document (remove onboarding task updates)
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

  RETURN jsonb_build_object(
    'success', true,
    'document_id', p_document_id,
    'status', p_status
  );
END;
$function$;

-- 4c. get_reports_analytics_overview (remove employee_exits & lms_course_enrollments queries)
CREATE OR REPLACE FUNCTION public.get_reports_analytics_overview(
  _organization_id uuid,
  _start_date date,
  _end_date date,
  _department_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
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
  -- A. Headcount Overview
  SELECT 
    COUNT(*) as total_employees,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'probation') as probation_count,
    COUNT(*) FILTER (WHERE status = 'notice') as notice_count,
    COUNT(*) FILTER (WHERE status IN ('resigned', 'relieved', 'inactive')) as inactive_count
  INTO v_headcount
  FROM public.employees
  WHERE organization_id = _organization_id
    AND (_department_id IS NULL OR department_id = _department_id);

  -- B. Department Distribution
  SELECT COALESCE(jsonb_agg(d_row), '[]'::jsonb) INTO v_dept_dist
  FROM (
    SELECT 
      COALESCE(d.name, 'Unassigned') as department,
      COUNT(e.id) as headcount
    FROM public.employees e
    LEFT JOIN public.departments d ON d.id = e.department_id
    WHERE e.organization_id = _organization_id
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
    AND (_department_id IS NULL OR e.department_id = _department_id);

  -- F. Shift Allocations
  SELECT COALESCE(jsonb_agg(s_row), '[]'::jsonb) INTO v_shifts
  FROM (
    SELECT 
      COALESCE(s.name, 'General Shift') as shift_name,
      COUNT(a.id) as assigned_employees
    FROM public.shifts s
    LEFT JOIN public.employee_shift_assignments a ON a.shift_id = s.id
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
$function$;

-- 4d. run_daily_automation_checks (remove onboarding reminder loop)
CREATE OR REPLACE FUNCTION public.run_daily_automation_checks(_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_count integer := 0;
  v_int_count integer := 0;
  v_rec record;
BEGIN
  -- A. Document Expiry Alerts (expiring in <= 30 days)
  FOR v_rec IN
    SELECT d.id, d.title, d.expiry_date, e.id as emp_id, e.user_id, e.full_name
    FROM public.documents d
    JOIN public.employees e ON e.id = d.employee_id
    WHERE e.organization_id = _organization_id
      AND d.expiry_date IS NOT NULL
      AND d.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + interval '30 days')
      AND e.user_id IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = v_rec.user_id
        AND type = 'document_expiry'
        AND created_at >= (now() - interval '3 days')
        AND metadata->>'document_id' = v_rec.id::text
    ) THEN
      INSERT INTO public.notifications (
        user_id,
        organization_id,
        employee_id,
        title,
        message,
        link,
        type,
        priority,
        metadata
      ) VALUES (
        v_rec.user_id,
        _organization_id,
        v_rec.emp_id,
        'Document Expiring Soon: ' || v_rec.title,
        'Your document "' || v_rec.title || '" is expiring on ' || v_rec.expiry_date::text || '. Please renew.',
        '/documents',
        'document_expiry',
        'high',
        jsonb_build_object('document_id', v_rec.id)
      );
      v_doc_count := v_doc_count + 1;
    END IF;
  END LOOP;

  -- B. Upcoming Interview Reminders
  FOR v_rec IN
    SELECT i.id, i.scheduled_at, c.full_name as candidate_name, j.title as job_title, e.id as emp_id, e.user_id
    FROM public.candidate_interviews i
    JOIN public.candidates c ON c.id = i.candidate_id
    JOIN public.job_openings j ON j.id = i.job_opening_id
    JOIN public.employees e ON e.id = i.interviewer_id
    WHERE i.organization_id = _organization_id
      AND i.status = 'scheduled'
      AND i.scheduled_at BETWEEN now() AND (now() + interval '24 hours')
      AND e.user_id IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = v_rec.user_id
        AND type = 'interview'
        AND created_at >= (now() - interval '12 hours')
        AND metadata->>'interview_id' = v_rec.id::text
    ) THEN
      INSERT INTO public.notifications (
        user_id,
        organization_id,
        employee_id,
        title,
        message,
        link,
        type,
        priority,
        metadata
      ) VALUES (
        v_rec.user_id,
        _organization_id,
        v_rec.emp_id,
        'Interview Reminder: ' || v_rec.candidate_name,
        'Upcoming interview for ' || v_rec.job_title || ' at ' || to_char(v_rec.scheduled_at, 'HH12:MI AM on Mon DD') || '.',
        '/recruitment',
        'interview',
        'high',
        jsonb_build_object('interview_id', v_rec.id)
      );
      v_int_count := v_int_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'document_reminders', v_doc_count,
    'interview_reminders', v_int_count,
    'executed_at', now()
  );
END;
$function$;
