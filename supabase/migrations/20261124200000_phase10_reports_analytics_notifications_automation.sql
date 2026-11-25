-- ==============================================================================
-- FLOWPEOPLE — PHASE 10: REPORTS, ANALYTICS, NOTIFICATIONS & AUTOMATION
-- ==============================================================================

-- 1. Extend notifications table with organization, employee, type, priority, and channel
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'delivered',
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_org_type 
  ON public.notifications (organization_id, type, created_at DESC);

-- Ensure RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications"
      ON public.notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications"
      ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'System and members can insert notifications'
  ) THEN
    CREATE POLICY "System and members can insert notifications"
      ON public.notifications FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  whatsapp_number text,
  notify_leave boolean NOT NULL DEFAULT true,
  notify_attendance boolean NOT NULL DEFAULT true,
  notify_shift boolean NOT NULL DEFAULT true,
  notify_expense boolean NOT NULL DEFAULT true,
  notify_ticket boolean NOT NULL DEFAULT true,
  notify_document_expiry boolean NOT NULL DEFAULT true,
  notify_onboarding boolean NOT NULL DEFAULT true,
  notify_interview boolean NOT NULL DEFAULT true,
  notify_performance boolean NOT NULL DEFAULT true,
  notify_payroll boolean NOT NULL DEFAULT true,
  notify_announcement boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_notif_pref_user_org UNIQUE (user_id, organization_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notification preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- 3. Notification Generation Functions & Triggers

-- A. Leave Alerts Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_leave_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp record;
  v_mgr record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT e.*, d.name as dept_name INTO v_emp
    FROM public.employees e
    LEFT JOIN public.departments d ON d.id = e.department_id
    WHERE e.id = NEW.employee_id;

    IF v_emp.reporting_manager_id IS NOT NULL THEN
      SELECT * INTO v_mgr FROM public.employees WHERE id = v_emp.reporting_manager_id;
      IF v_mgr.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (
          user_id,
          organization_id,
          employee_id,
          title,
          message,
          link,
          type,
          priority
        ) VALUES (
          v_mgr.user_id,
          v_emp.organization_id,
          v_mgr.id,
          'New Leave Application',
          v_emp.full_name || ' applied for leave (' || NEW.from_date || ' to ' || NEW.to_date || ').',
          '/leaves',
          'leave',
          'normal'
        );
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO v_emp FROM public.employees WHERE id = NEW.employee_id;
    IF v_emp.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        organization_id,
        employee_id,
        title,
        message,
        link,
        type,
        priority
      ) VALUES (
        v_emp.user_id,
        v_emp.organization_id,
        v_emp.id,
        'Leave Request ' || INITCAP(NEW.status),
        'Your leave application for ' || NEW.from_date || ' has been ' || NEW.status || '.',
        '/leaves',
        'leave',
        CASE WHEN NEW.status = 'approved' THEN 'normal' ELSE 'high' END
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_notification ON public.leave_requests;
CREATE TRIGGER trg_leave_notification
  AFTER INSERT OR UPDATE OF status ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_leave_notification();

-- B. Expense Alerts Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_expense_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp record;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO v_emp FROM public.employees WHERE id = NEW.employee_id;
    IF v_emp.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        organization_id,
        employee_id,
        title,
        message,
        link,
        type,
        priority
      ) VALUES (
        v_emp.user_id,
        v_emp.organization_id,
        v_emp.id,
        'Expense Claim ' || INITCAP(NEW.status),
        'Your claim for ₹' || NEW.amount || ' (' || NEW.category || ') is now ' || NEW.status || '.',
        '/expenses',
        'expense',
        'normal'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_notification ON public.expense_claims;
CREATE TRIGGER trg_expense_notification
  AFTER UPDATE OF status ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_expense_notification();

-- C. HR Ticket Alerts Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_ticket_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp record;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO v_emp FROM public.employees WHERE id = NEW.employee_id;
    IF v_emp.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        organization_id,
        employee_id,
        title,
        message,
        link,
        type,
        priority
      ) VALUES (
        v_emp.user_id,
        v_emp.organization_id,
        v_emp.id,
        'Support Ticket ' || INITCAP(NEW.status),
        'Your ticket "' || NEW.subject || '" status changed to ' || NEW.status || '.',
        '/helpdesk',
        'ticket',
        'normal'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_notification ON public.hr_tickets;
CREATE TRIGGER trg_ticket_notification
  AFTER UPDATE OF status ON public.hr_tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_ticket_notification();

-- D. Payroll Published Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_payroll_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'locked' AND OLD.status != 'locked' THEN
    FOR v_emp IN
      SELECT * FROM public.employees 
      WHERE organization_id = NEW.organization_id AND status = 'active' AND user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (
        user_id,
        organization_id,
        employee_id,
        title,
        message,
        link,
        type,
        priority
      ) VALUES (
        v_emp.user_id,
        NEW.organization_id,
        v_emp.id,
        'Payslip Published: ' || NEW.title,
        'Your official compensation payslip for ' || NEW.title || ' is available in Employee Self-Service.',
        '/payroll',
        'payroll',
        'high'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_notification ON public.payroll_runs;
CREATE TRIGGER trg_payroll_notification
  AFTER UPDATE OF status ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_payroll_notification();

-- E. Announcement Notification Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_announcement_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp record;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_published = true THEN
    FOR v_emp IN
      SELECT * FROM public.employees 
      WHERE organization_id = NEW.organization_id 
        AND status = 'active' 
        AND user_id IS NOT NULL
        AND (NEW.target = 'all' OR department_id IS NOT DISTINCT FROM NEW.target_department_id)
    LOOP
      INSERT INTO public.notifications (
        user_id,
        organization_id,
        employee_id,
        title,
        message,
        link,
        type,
        priority
      ) VALUES (
        v_emp.user_id,
        NEW.organization_id,
        v_emp.id,
        'New Announcement: ' || NEW.title,
        COALESCE(NEW.summary, SUBSTRING(NEW.message FROM 1 FOR 120)),
        '/announcements',
        'announcement',
        CASE WHEN NEW.priority = 'urgent' THEN 'urgent' WHEN NEW.priority = 'high' THEN 'high' ELSE 'normal' END
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_announcement_notification ON public.announcements;
CREATE TRIGGER trg_announcement_notification
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_announcement_notification();

-- 4. Daily Automation RPC (Document expiry, Onboarding, Interview reminders)
CREATE OR REPLACE FUNCTION public.run_daily_automation_checks(
  _organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_doc_count integer := 0;
  v_onb_count integer := 0;
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

  -- B. Onboarding Task Reminders (pending tasks)
  FOR v_rec IN
    SELECT t.id, t.title, e.id as emp_id, e.user_id, e.full_name
    FROM public.employee_onboarding_tasks t
    JOIN public.employees e ON e.id = t.employee_id
    WHERE e.organization_id = _organization_id
      AND t.status = 'pending'
      AND e.user_id IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = v_rec.user_id
        AND type = 'onboarding'
        AND created_at >= (now() - interval '2 days')
        AND metadata->>'task_id' = v_rec.id::text
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
        'Onboarding Step Pending: ' || v_rec.title,
        'Please complete your pending onboarding task "' || v_rec.title || '".',
        '/onboarding',
        'onboarding',
        'normal',
        jsonb_build_object('task_id', v_rec.id)
      );
      v_onb_count := v_onb_count + 1;
    END IF;
  END LOOP;

  -- C. Upcoming Interview Reminders
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
    'onboarding_reminders', v_onb_count,
    'interview_reminders', v_int_count,
    'executed_at', now()
  );
END;
$$;

-- 5. Optimized SQL Aggregation RPC for Reports & Analytics
CREATE OR REPLACE FUNCTION public.get_reports_analytics_overview(
  _organization_id uuid,
  _start_date date,
  _end_date date,
  _department_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_headcount record;
  v_dept_dist jsonb;
  v_new_hires jsonb;
  v_exits jsonb;
  v_attendance jsonb;
  v_leaves jsonb;
  v_shifts jsonb;
  v_recruitment jsonb;
  v_performance jsonb;
  v_expenses jsonb;
  v_payroll jsonb;
  v_training jsonb;
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

  -- D. Employee Exits
  SELECT COALESCE(jsonb_agg(ex_row), '[]'::jsonb) INTO v_exits
  FROM (
    SELECT 
      x.id,
      x.resignation_date,
      x.agreed_last_working_day,
      x.reason_category,
      x.status,
      e.full_name,
      e.employee_code
    FROM public.employee_exits x
    JOIN public.employees e ON e.id = x.employee_id
    WHERE x.organization_id = _organization_id
      AND x.resignation_date BETWEEN _start_date AND _end_date
      AND (_department_id IS NULL OR e.department_id = _department_id)
    ORDER BY x.resignation_date DESC
  ) ex_row;

  -- E. Attendance Aggregates
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

  -- F. Leave Utilization
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

  -- G. Shift Allocations
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

  -- H. Recruitment Pipeline
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

  -- I. Expenses Summary
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

  -- J. Payroll Summaries
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

  -- K. HR Ticket Statistics
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

  -- L. Training Completion
  SELECT COALESCE(jsonb_build_object(
    'total_enrollments', COUNT(*),
    'completed', COUNT(*) FILTER (WHERE e.status = 'completed'),
    'in_progress', COUNT(*) FILTER (WHERE e.status = 'in_progress'),
    'enrolled', COUNT(*) FILTER (WHERE e.status = 'enrolled')
  ), '{}'::jsonb) INTO v_training
  FROM public.lms_course_enrollments e
  WHERE e.organization_id = _organization_id;

  -- M. Performance Summaries
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
    'exits', v_exits,
    'attendance', v_attendance,
    'leaves', v_leaves,
    'shifts', v_shifts,
    'recruitment', v_recruitment,
    'expenses', v_expenses,
    'payroll', v_payroll,
    'tickets', v_tickets,
    'training', v_training,
    'performance', v_performance
  );
END;
$$;

-- 6. Enable Realtime Publications
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
