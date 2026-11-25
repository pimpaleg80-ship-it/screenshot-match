-- ==============================================================================
-- FLOWPEOPLE — PHASE 11: PRODUCTION READINESS HARDENING
-- Security, RLS Completion, Search Path Hardening & Performance Index Optimization
-- ==============================================================================

-- 1. Complete RLS policies on tables lacking policies
-- A. employee_shift_assignments
ALTER TABLE public.employee_shift_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'employee_shift_assignments' AND policyname = 'employee_shift_assignments_view'
  ) THEN
    CREATE POLICY "employee_shift_assignments_view"
      ON public.employee_shift_assignments FOR SELECT
      USING (
        auth.uid() IN (SELECT user_id FROM public.employees WHERE id = employee_id)
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
        OR is_superadmin(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'employee_shift_assignments' AND policyname = 'employee_shift_assignments_manage'
  ) THEN
    CREATE POLICY "employee_shift_assignments_manage"
      ON public.employee_shift_assignments FOR ALL
      USING (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
        OR is_superadmin(auth.uid())
      )
      WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
        OR is_superadmin(auth.uid())
      );
  END IF;
END $$;

-- B. geofence_zones
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'geofence_zones' AND policyname = 'geofence_zones_read'
  ) THEN
    CREATE POLICY "geofence_zones_read"
      ON public.geofence_zones FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'geofence_zones' AND policyname = 'geofence_zones_manage'
  ) THEN
    CREATE POLICY "geofence_zones_manage"
      ON public.geofence_zones FOR ALL
      USING (
        has_role(auth.uid(), 'admin'::app_role)
        OR is_superadmin(auth.uid())
      )
      WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role)
        OR is_superadmin(auth.uid())
      );
  END IF;
END $$;

-- 2. Harden SECURITY DEFINER search_path on Phase 8, 9, 10 functions
ALTER FUNCTION public.approve_payroll_run(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.calculate_monthly_payroll_run(uuid, integer, integer, uuid) SET search_path = public;
ALTER FUNCTION public.finalize_employee_exit(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.get_reports_analytics_overview(uuid, date, date, uuid) SET search_path = public;
ALTER FUNCTION public.lock_payroll_run(uuid, uuid, date, text, text) SET search_path = public;
ALTER FUNCTION public.mark_announcement_read(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.review_employee_resignation(uuid, uuid, text, date, integer, text) SET search_path = public;
ALTER FUNCTION public.run_daily_automation_checks(uuid) SET search_path = public;
ALTER FUNCTION public.submit_employee_resignation(uuid, date, text, text) SET search_path = public;
ALTER FUNCTION public.submit_engagement_survey_response(uuid, uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.toggle_suggestion_upvote(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.trg_fn_announcement_notification() SET search_path = public;
ALTER FUNCTION public.trg_fn_expense_notification() SET search_path = public;
ALTER FUNCTION public.trg_fn_leave_notification() SET search_path = public;
ALTER FUNCTION public.trg_fn_payroll_notification() SET search_path = public;
ALTER FUNCTION public.trg_fn_ticket_notification() SET search_path = public;

-- 3. High Impact Foreign Key & Query Index Optimization
CREATE INDEX IF NOT EXISTS idx_employee_shift_assignments_emp_id ON public.employee_shift_assignments (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shift_assignments_org_id ON public.employee_shift_assignments (organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_shift_assignments_shift_id ON public.employee_shift_assignments (shift_id);

CREATE INDEX IF NOT EXISTS idx_geofence_zones_location_id ON public.geofence_zones (location_id);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id ON public.announcement_reads (user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_surveys_org_dept ON public.engagement_surveys (organization_id, target_department_id);
CREATE INDEX IF NOT EXISTS idx_engagement_responses_survey_user ON public.engagement_responses (survey_id, user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_responses_emp ON public.engagement_responses (employee_id);
CREATE INDEX IF NOT EXISTS idx_engagement_answers_org_survey ON public.engagement_answers (organization_id, survey_id);
CREATE INDEX IF NOT EXISTS idx_employee_suggestions_org_user ON public.employee_suggestions (organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_employee_suggestion_upvotes_sugg ON public.employee_suggestion_upvotes (suggestion_id);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON public.notification_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_org ON public.notification_preferences (organization_id);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_org_dates ON public.payroll_runs (organization_id, year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_history_run_id ON public.payroll_history (payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_emp_run ON public.payslips (employee_id, payroll_run_id);

CREATE INDEX IF NOT EXISTS idx_employee_exits_org_status ON public.employee_exits (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_exit_kt_tasks_exit_id ON public.exit_kt_tasks (exit_id);
CREATE INDEX IF NOT EXISTS idx_exit_asset_returns_exit_id ON public.exit_asset_returns (exit_id);
CREATE INDEX IF NOT EXISTS idx_exit_clearances_exit_id ON public.exit_clearances (exit_id);
CREATE INDEX IF NOT EXISTS idx_exit_interviews_exit_id ON public.exit_interviews (exit_id);
CREATE INDEX IF NOT EXISTS idx_exit_fnf_settlements_exit_id ON public.exit_fnf_settlements (exit_id);

CREATE INDEX IF NOT EXISTS idx_hr_ticket_comments_ticket_id ON public.hr_ticket_comments (ticket_id);
CREATE INDEX IF NOT EXISTS idx_lms_quiz_attempts_enrollment ON public.lms_quiz_attempts (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_lms_certificates_enrollment ON public.lms_certificates (enrollment_id);
