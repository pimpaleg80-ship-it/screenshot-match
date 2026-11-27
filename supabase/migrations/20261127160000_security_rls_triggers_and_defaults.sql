-- Security & Integrity Migration:
-- 1. Backfill NULL organization_id values on org-scoped tables
-- 2. Add BEFORE INSERT defaults for organization_id and sync holidays.title <-> holidays.name
-- 3. Scope provision_new_leave_type_balances() by organization_id and exclude superadmins
-- 4. Drop duplicate legacy leave notification triggers on leave_requests
-- 5. Replace permissive/unscoped RLS policies on documents, expense_claims, hr_tickets,
--    performance_reviews, holidays, settings, leave_types, leave_policies, shifts, announcements
-- 6. Reload PostgREST schema cache

-- ============================================================================
-- 1. Backfill missing organization_id rows safely
-- ============================================================================
DO $$
DECLARE
  v_default_org uuid;
BEGIN
  SELECT id INTO v_default_org FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF v_default_org IS NULL THEN
    v_default_org := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  UPDATE public.documents d
  SET organization_id = COALESCE(
    (SELECT e.organization_id FROM public.employees e WHERE e.id = d.employee_id),
    v_default_org
  )
  WHERE d.organization_id IS NULL;

  UPDATE public.expense_claims ec
  SET organization_id = COALESCE(
    (SELECT e.organization_id FROM public.employees e WHERE e.id = ec.employee_id),
    v_default_org
  )
  WHERE ec.organization_id IS NULL;

  UPDATE public.hr_tickets t
  SET organization_id = COALESCE(
    (SELECT e.organization_id FROM public.employees e WHERE e.id = t.employee_id),
    v_default_org
  )
  WHERE t.organization_id IS NULL;

  UPDATE public.performance_reviews pr
  SET organization_id = COALESCE(
    (SELECT e.organization_id FROM public.employees e WHERE e.id = pr.employee_id),
    v_default_org
  )
  WHERE pr.organization_id IS NULL;

  UPDATE public.holidays SET organization_id = v_default_org WHERE organization_id IS NULL;
  UPDATE public.holidays SET title = COALESCE(NULLIF(title, ''), name) WHERE title IS NULL OR title = '';
  UPDATE public.holidays SET name = COALESCE(NULLIF(name, ''), title) WHERE name IS NULL OR name = '';

  UPDATE public.leave_types SET organization_id = v_default_org WHERE organization_id IS NULL;
  UPDATE public.leave_policies SET organization_id = v_default_org WHERE organization_id IS NULL;
  UPDATE public.settings SET organization_id = v_default_org WHERE organization_id IS NULL;
  UPDATE public.announcements SET organization_id = v_default_org WHERE organization_id IS NULL;
END $$;

-- ============================================================================
-- 2. Shared BEFORE INSERT Triggers for organization_id & holidays sync
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_row_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_employee_org_id();
  END IF;
  IF NEW.organization_id IS NULL THEN
    SELECT id INTO NEW.organization_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_holiday_title_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_label text;
BEGIN
  v_label := COALESCE(NULLIF(trim(NEW.title), ''), NULLIF(trim(NEW.name), ''));
  NEW.title := v_label;
  NEW.name := v_label;
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_employee_org_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_holidays_sync_fields ON public.holidays;
CREATE TRIGGER trg_holidays_sync_fields
  BEFORE INSERT OR UPDATE ON public.holidays
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_holiday_title_name();

DROP TRIGGER IF EXISTS trg_shifts_set_org_id ON public.shifts;
CREATE TRIGGER trg_shifts_set_org_id
  BEFORE INSERT ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_organization_id();

DROP TRIGGER IF EXISTS trg_leave_types_set_org_id ON public.leave_types;
CREATE TRIGGER trg_leave_types_set_org_id
  BEFORE INSERT ON public.leave_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_organization_id();

DROP TRIGGER IF EXISTS trg_leave_policies_set_org_id ON public.leave_policies;
CREATE TRIGGER trg_leave_policies_set_org_id
  BEFORE INSERT ON public.leave_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_organization_id();

DROP TRIGGER IF EXISTS trg_documents_set_org_id ON public.documents;
CREATE TRIGGER trg_documents_set_org_id
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_organization_id();

DROP TRIGGER IF EXISTS trg_announcements_set_org_id ON public.announcements;
CREATE TRIGGER trg_announcements_set_org_id
  BEFORE INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_organization_id();

-- ============================================================================
-- 3. Scope provision_new_leave_type_balances() strictly by organization & non-root
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provision_new_leave_type_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total, used, organization_id)
  SELECT e.id, NEW.id, EXTRACT(YEAR FROM now())::int, NEW.days_per_year, 0, e.organization_id
  FROM public.employees e
  WHERE e.is_superadmin IS NOT TRUE
    AND (NEW.organization_id IS NULL OR e.organization_id = NEW.organization_id)
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. Drop duplicate legacy leave notification triggers (keep trg_leave_notification)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_notify_leave_apply ON public.leave_requests;
DROP TRIGGER IF EXISTS trg_notify_leave_decision ON public.leave_requests;

-- ============================================================================
-- 5. Strict Multi-Tenant RLS Policies
-- ============================================================================

-- 5a. documents (remove permissive qual=true leak!)
DROP POLICY IF EXISTS "documents: read all" ON public.documents;
DROP POLICY IF EXISTS "documents: admin write" ON public.documents;
DROP POLICY IF EXISTS "documents: manager write" ON public.documents;
DROP POLICY IF EXISTS "documents_admin_all" ON public.documents;
DROP POLICY IF EXISTS "documents_employee_insert" ON public.documents;
DROP POLICY IF EXISTS "documents_employee_select" ON public.documents;
DROP POLICY IF EXISTS "documents_select_scoped" ON public.documents;
DROP POLICY IF EXISTS "documents_insert_scoped" ON public.documents;
DROP POLICY IF EXISTS "documents_update_scoped" ON public.documents;
DROP POLICY IF EXISTS "documents_delete_scoped" ON public.documents;

CREATE POLICY "documents_select_scoped"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      public.is_org_member(organization_id)
      AND (
        public.is_org_admin(organization_id)
        OR employee_id = public.current_employee_id()
        OR (is_company_policy IS TRUE AND is_confidential IS NOT TRUE)
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND public.is_my_team_member(employee_id)
          AND is_confidential IS NOT TRUE
        )
      )
    )
  );

CREATE POLICY "documents_insert_scoped"
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      public.is_org_member(organization_id)
      AND (
        public.is_org_admin(organization_id)
        OR employee_id = public.current_employee_id()
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND public.is_my_team_member(employee_id)
        )
      )
    )
  );

CREATE POLICY "documents_update_scoped"
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(organization_id)
    OR (
      public.is_org_member(organization_id)
      AND employee_id = public.current_employee_id()
      AND verification_status = 'pending_verification'
    )
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(organization_id)
    OR (
      public.is_org_member(organization_id)
      AND employee_id = public.current_employee_id()
    )
  );

CREATE POLICY "documents_delete_scoped"
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(organization_id)
    OR (
      public.is_org_member(organization_id)
      AND employee_id = public.current_employee_id()
      AND verification_status = 'pending_verification'
    )
  );

-- 5b. expense_claims (org-scoped)
DROP POLICY IF EXISTS "expenses_admin_all" ON public.expense_claims;
DROP POLICY IF EXISTS "expenses_employee_select" ON public.expense_claims;
DROP POLICY IF EXISTS "expenses_employee_insert" ON public.expense_claims;
DROP POLICY IF EXISTS "expenses_select_scoped" ON public.expense_claims;
DROP POLICY IF EXISTS "expenses_insert_scoped" ON public.expense_claims;
DROP POLICY IF EXISTS "expenses_manage_scoped" ON public.expense_claims;

CREATE POLICY "expenses_select_scoped"
  ON public.expense_claims
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
      AND (
        employee_id = public.current_employee_id()
        OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND public.is_my_team_member(employee_id)
        )
      )
    )
  );

CREATE POLICY "expenses_insert_scoped"
  ON public.expense_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      employee_id = public.current_employee_id()
      AND public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
    )
    OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
  );

CREATE POLICY "expenses_manage_scoped"
  ON public.expense_claims
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
    OR (
      public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      AND public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
      AND public.is_my_team_member(employee_id)
    )
    OR (employee_id = public.current_employee_id() AND status = 'pending')
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
    OR (
      public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      AND public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
      AND public.is_my_team_member(employee_id)
    )
    OR employee_id = public.current_employee_id()
  );

-- 5c. hr_tickets (org-scoped)
DROP POLICY IF EXISTS "hr_tickets_admin_all" ON public.hr_tickets;
DROP POLICY IF EXISTS "hr_tickets_employee_select" ON public.hr_tickets;
DROP POLICY IF EXISTS "hr_tickets_employee_insert" ON public.hr_tickets;
DROP POLICY IF EXISTS "hr_tickets_select_scoped" ON public.hr_tickets;
DROP POLICY IF EXISTS "hr_tickets_insert_scoped" ON public.hr_tickets;
DROP POLICY IF EXISTS "hr_tickets_manage_scoped" ON public.hr_tickets;

CREATE POLICY "hr_tickets_select_scoped"
  ON public.hr_tickets
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
      AND (
        employee_id = public.current_employee_id()
        OR assigned_employee_id = public.current_employee_id()
        OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND public.is_my_team_member(employee_id)
        )
      )
    )
  );

CREATE POLICY "hr_tickets_insert_scoped"
  ON public.hr_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      employee_id = public.current_employee_id()
      AND public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
    )
    OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
  );

CREATE POLICY "hr_tickets_manage_scoped"
  ON public.hr_tickets
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
    OR assigned_employee_id = public.current_employee_id()
    OR (
      public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      AND public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
      AND public.is_my_team_member(employee_id)
    )
    OR employee_id = public.current_employee_id()
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
    OR assigned_employee_id = public.current_employee_id()
    OR (
      public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      AND public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
      AND public.is_my_team_member(employee_id)
    )
    OR employee_id = public.current_employee_id()
  );

-- 5d. performance_reviews (org & team scoped)
DROP POLICY IF EXISTS "Employees and Managers can update reviews" ON public.performance_reviews;
DROP POLICY IF EXISTS "Users can view reviews of self or direct reports" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_admin_all" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_employee_select" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews_select_scoped" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews_manage_scoped" ON public.performance_reviews;

CREATE POLICY "performance_reviews_select_scoped"
  ON public.performance_reviews
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
      AND (
        employee_id = public.current_employee_id()
        OR reviewer_id = public.current_employee_id()
        OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND public.is_my_team_member(employee_id)
        )
      )
    )
  );

CREATE POLICY "performance_reviews_manage_scoped"
  ON public.performance_reviews
  FOR ALL
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
      AND (
        employee_id = public.current_employee_id()
        OR reviewer_id = public.current_employee_id()
        OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND public.is_my_team_member(employee_id)
        )
      )
    )
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      public.is_org_member(COALESCE(organization_id, public.current_employee_org_id()))
      AND (
        employee_id = public.current_employee_id()
        OR reviewer_id = public.current_employee_id()
        OR public.is_org_admin(COALESCE(organization_id, public.current_employee_org_id()))
        OR (
          public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
          AND public.is_my_team_member(employee_id)
        )
      )
    )
  );

-- 5e. holidays (org-scoped)
DROP POLICY IF EXISTS "holidays: read all" ON public.holidays;
DROP POLICY IF EXISTS "holidays_read_all" ON public.holidays;
DROP POLICY IF EXISTS "holidays: admin write" ON public.holidays;
DROP POLICY IF EXISTS "holidays_select_scoped" ON public.holidays;
DROP POLICY IF EXISTS "holidays_admin_manage" ON public.holidays;

CREATE POLICY "holidays_select_scoped"
  ON public.holidays
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "holidays_admin_manage"
  ON public.holidays
  FOR ALL
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_strict_admin(organization_id)
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_strict_admin(organization_id)
  );

-- 5f. settings (org-scoped)
DROP POLICY IF EXISTS "settings: read all" ON public.settings;
DROP POLICY IF EXISTS "settings: admin write" ON public.settings;
DROP POLICY IF EXISTS "settings_select_scoped" ON public.settings;
DROP POLICY IF EXISTS "settings_admin_manage" ON public.settings;

CREATE POLICY "settings_select_scoped"
  ON public.settings
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "settings_admin_manage"
  ON public.settings
  FOR ALL
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_strict_admin(organization_id)
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_strict_admin(organization_id)
  );

-- 5g. leave_types & leave_policies (org-scoped)
DROP POLICY IF EXISTS "leave_types: read all" ON public.leave_types;
DROP POLICY IF EXISTS "leave_types: admin write" ON public.leave_types;
DROP POLICY IF EXISTS "leave_types_hr_admin_all" ON public.leave_types;
DROP POLICY IF EXISTS "leave_types_select_scoped" ON public.leave_types;
DROP POLICY IF EXISTS "leave_types_admin_manage" ON public.leave_types;

CREATE POLICY "leave_types_select_scoped"
  ON public.leave_types
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "leave_types_admin_manage"
  ON public.leave_types
  FOR ALL
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(organization_id)
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Allow authenticated to view active leave policies" ON public.leave_policies;
DROP POLICY IF EXISTS "Allow admin to manage leave policies" ON public.leave_policies;
DROP POLICY IF EXISTS "leave_policies_select_scoped" ON public.leave_policies;
DROP POLICY IF EXISTS "leave_policies_admin_manage" ON public.leave_policies;

CREATE POLICY "leave_policies_select_scoped"
  ON public.leave_policies
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "leave_policies_admin_manage"
  ON public.leave_policies
  FOR ALL
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(organization_id)
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(organization_id)
  );

-- 5h. shifts (org-scoped; replace overly permissive shifts_view_authenticated & shifts_admin_all)
DROP POLICY IF EXISTS "shifts_view_authenticated" ON public.shifts;
DROP POLICY IF EXISTS "shifts_admin_all" ON public.shifts;
DROP POLICY IF EXISTS "shifts_admin_manage" ON public.shifts;
DROP POLICY IF EXISTS "shifts_read" ON public.shifts;
DROP POLICY IF EXISTS "shifts_select_scoped" ON public.shifts;

CREATE POLICY "shifts_select_scoped"
  ON public.shifts
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "shifts_admin_manage"
  ON public.shifts
  FOR ALL
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_strict_admin(organization_id)
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_strict_admin(organization_id)
  );

-- 5i. announcements (org-scoped)
DROP POLICY IF EXISTS "announcements: select target" ON public.announcements;
DROP POLICY IF EXISTS "announcements: admin write" ON public.announcements;
DROP POLICY IF EXISTS "announcements: manager write department" ON public.announcements;
DROP POLICY IF EXISTS "announcements_select_scoped" ON public.announcements;
DROP POLICY IF EXISTS "announcements_manage_scoped" ON public.announcements;

CREATE POLICY "announcements_select_scoped"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR (
      public.is_org_member(organization_id)
      AND (expires_at IS NULL OR expires_at > now())
      AND (
        public.is_org_admin(organization_id)
        OR target = 'all'
        OR (target = 'department' AND target_department_id = public.current_employee_dept_id())
        OR (target = 'selected' AND public.current_employee_id() = ANY(target_employee_ids))
      )
    )
  );

CREATE POLICY "announcements_manage_scoped"
  ON public.announcements
  FOR ALL
  TO authenticated
  USING (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(organization_id)
  )
  WITH CHECK (
    public.is_superadmin((SELECT auth.uid()))
    OR public.is_org_admin(organization_id)
    OR (
      public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
      AND public.is_org_member(organization_id)
      AND target = 'department'
      AND target_department_id = public.current_employee_dept_id()
    )
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
