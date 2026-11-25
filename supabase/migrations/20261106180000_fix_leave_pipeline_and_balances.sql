-- ==============================================================================
-- Migration: 20261106180000_fix_leave_pipeline_and_balances.sql
-- Description: 
--   1. Fixes infinite recursion on employees table by introducing a SECURITY DEFINER helper.
--   2. Adds color column to leave_types.
--   3. Upgrades leave_requests and leave_balances RLS for multi-tenant roles (org_admin, super_admin, hr_manager).
--   4. Adds auto-population and triggers for leave_balances on employee creation.
--   5. Fixes notification links to point to valid route /leaves.
--   6. Ensures organization_id is auto-populated on leave_requests and attendance records.
-- ==============================================================================

-- 1. Helper function to check admin / HR permissions safely without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager')
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.employees
    WHERE user_id = auth.uid() AND is_superadmin = true
  );
$$;

-- 2. Drop and replace recursive policy on employees
DROP POLICY IF EXISTS "employees_manage_admin_policy" ON public.employees;
CREATE POLICY "employees_manage_admin_policy" ON public.employees
  FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin())
  WITH CHECK (public.is_admin_or_superadmin());

-- 3. Add color column to leave_types
ALTER TABLE public.leave_types 
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1';

-- Update standard colors for existing leave types
UPDATE public.leave_types SET color = '#3b82f6' WHERE name ILIKE '%casual%' AND (color IS NULL OR color = '#6366f1');
UPDATE public.leave_types SET color = '#f43f5e' WHERE name ILIKE '%sick%' AND (color IS NULL OR color = '#6366f1');
UPDATE public.leave_types SET color = '#10b981' WHERE (name ILIKE '%paid%' OR name ILIKE '%earned%') AND (color IS NULL OR color = '#6366f1');
UPDATE public.leave_types SET color = '#64748b' WHERE name ILIKE '%unpaid%' AND (color IS NULL OR color = '#6366f1');
UPDATE public.leave_types SET color = '#8b5cf6' WHERE (name ILIKE '%home%' OR name ILIKE '%wfh%') AND (color IS NULL OR color = '#6366f1');

-- 4. Upgrade RLS on leave_requests
DROP POLICY IF EXISTS "leave_requests: admin all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_admin_all_policy" ON public.leave_requests;

CREATE POLICY "leave_requests_admin_all_policy" ON public.leave_requests
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_superadmin()
    OR (
      has_role(auth.uid(), 'manager'::app_role) 
      AND (is_my_team_member(employee_id) OR employee_id = current_employee_id())
    )
  )
  WITH CHECK (
    public.is_admin_or_superadmin()
    OR (
      has_role(auth.uid(), 'manager'::app_role) 
      AND (is_my_team_member(employee_id) OR employee_id = current_employee_id())
    )
  );

-- Auto-fill organization_id on leave_requests if not provided
CREATE OR REPLACE FUNCTION public.set_leave_request_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.employees
    WHERE id = NEW.employee_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_leave_org_id ON public.leave_requests;
CREATE TRIGGER trg_set_leave_org_id
BEFORE INSERT ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.set_leave_request_org_id();

-- 5. Upgrade RLS on leave_balances
DROP POLICY IF EXISTS "leave_balances: admin all" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_admin_all_policy" ON public.leave_balances;

CREATE POLICY "leave_balances_admin_all_policy" ON public.leave_balances
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_superadmin()
    OR (
      has_role(auth.uid(), 'manager'::app_role) 
      AND (is_my_team_member(employee_id) OR employee_id = current_employee_id())
    )
  )
  WITH CHECK (
    public.is_admin_or_superadmin()
  );

-- 6. Populate leave_balances for all active employees for current year
INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total, used, organization_id)
SELECT e.id, lt.id, EXTRACT(YEAR FROM now())::int, lt.days_per_year, 0, e.organization_id
FROM public.employees e
CROSS JOIN public.leave_types lt
WHERE lt.active = true
ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

-- Trigger to auto-provision leave_balances when an employee is inserted
CREATE OR REPLACE FUNCTION public.provision_employee_leave_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total, used, organization_id)
  SELECT NEW.id, lt.id, EXTRACT(YEAR FROM now())::int, lt.days_per_year, 0, NEW.organization_id
  FROM public.leave_types lt
  WHERE lt.active = true
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emp_leave_balances ON public.employees;
CREATE TRIGGER trg_emp_leave_balances
AFTER INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.provision_employee_leave_balances();

-- Trigger to auto-provision balances when a new leave type is added
CREATE OR REPLACE FUNCTION public.provision_new_leave_type_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total, used, organization_id)
  SELECT e.id, NEW.id, EXTRACT(YEAR FROM now())::int, NEW.days_per_year, 0, e.organization_id
  FROM public.employees e
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_leave_type_balances ON public.leave_types;
CREATE TRIGGER trg_new_leave_type_balances
AFTER INSERT ON public.leave_types
FOR EACH ROW EXECUTE FUNCTION public.provision_new_leave_type_balances();

-- 7. Fix notify_on_leave_apply to notify organization admins and route to /leaves
CREATE OR REPLACE FUNCTION public.notify_on_leave_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  mgr_user uuid; 
  emp_name text;
  emp_user_id uuid;
BEGIN
  SELECT full_name, user_id INTO emp_name, emp_user_id 
  FROM public.employees 
  WHERE id = NEW.employee_id;

  -- Notify direct manager if assigned
  SELECT e.user_id INTO mgr_user 
  FROM public.employees e
  JOIN public.employees x ON x.manager_id = e.id 
  WHERE x.id = NEW.employee_id;

  IF mgr_user IS NOT NULL AND mgr_user <> emp_user_id THEN
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (mgr_user, 'New leave request', emp_name || ' applied for leave', '/leaves');
  END IF;

  -- Notify all org admins and super admins
  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT DISTINCT u.user_id, 'New leave request', emp_name || ' applied for leave', '/leaves'
  FROM (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
    UNION
    SELECT om.user_id FROM public.organization_members om
    WHERE om.role IN ('super_admin', 'org_admin', 'hr_manager')
      AND (NEW.organization_id IS NULL OR om.organization_id = NEW.organization_id)
  ) u
  WHERE u.user_id IS NOT NULL 
    AND u.user_id <> COALESCE(emp_user_id, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN NEW;
END;
$$;

-- 8. Fix notify_on_leave_decision to route to /leaves
CREATE OR REPLACE FUNCTION public.notify_on_leave_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  emp_user uuid;
BEGIN
  IF NEW.status IN ('approved','rejected') AND OLD.status = 'pending' THEN
    SELECT user_id INTO emp_user FROM public.employees WHERE id = NEW.employee_id;
    IF emp_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (emp_user, 'Leave ' || NEW.status, 'Your leave request was ' || NEW.status, '/leaves');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 9. Update handle_leave_status_change to preserve organization_id on attendance
CREATE OR REPLACE FUNCTION public.handle_leave_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  d date;
  v_org_id uuid;
BEGIN
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

  ELSIF OLD.status = 'approved' AND NEW.status IN ('cancelled','rejected') THEN
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
$$;

