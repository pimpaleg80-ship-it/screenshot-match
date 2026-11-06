-- ==============================================================================
-- Migration: 20261106170000_face_profile_save_and_rls_enhancements.sql
-- Description: Fixes profile face biometric save, adds default consent,
--              expands RLS for face_data and employees to multi-tenant roles,
--              and adds INSTEAD OF UPDATE trigger to face_descriptors view.
-- ==============================================================================

-- 1. Ensure consent has default true on face_data table
ALTER TABLE public.face_data 
  ALTER COLUMN consent SET DEFAULT true;

-- 2. Expand RLS policies on face_data table
DROP POLICY IF EXISTS "face_data: admin only" ON public.face_data;
DROP POLICY IF EXISTS "face_data_select_policy" ON public.face_data;
DROP POLICY IF EXISTS "face_data_manage_policy" ON public.face_data;

CREATE POLICY "face_data_select_policy" ON public.face_data
  FOR SELECT TO authenticated
  USING (
    employee_id = current_employee_id()
    OR (SELECT is_superadmin FROM public.employees WHERE user_id = auth.uid() LIMIT 1) = true
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager')
    )
  );

CREATE POLICY "face_data_manage_policy" ON public.face_data
  FOR ALL TO authenticated
  USING (
    employee_id = current_employee_id()
    OR (SELECT is_superadmin FROM public.employees WHERE user_id = auth.uid() LIMIT 1) = true
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager')
    )
  )
  WITH CHECK (
    employee_id = current_employee_id()
    OR (SELECT is_superadmin FROM public.employees WHERE user_id = auth.uid() LIMIT 1) = true
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager')
    )
  );

-- 3. Add INSTEAD OF UPDATE trigger to face_descriptors view
CREATE OR REPLACE FUNCTION public.instead_of_update_face_descriptors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.face_data (employee_id, descriptor, consent, enrolled_at)
  VALUES (NEW.person_id, NEW.descriptor, true, now())
  ON CONFLICT (employee_id) DO UPDATE SET
    descriptor = EXCLUDED.descriptor,
    enrolled_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_face_desc_update ON public.face_descriptors;
CREATE TRIGGER trg_face_desc_update
INSTEAD OF UPDATE ON public.face_descriptors
FOR EACH ROW EXECUTE FUNCTION public.instead_of_update_face_descriptors();

-- 4. Ensure employees table update policy allows org_admin, super_admin, and hr_manager
DROP POLICY IF EXISTS "employees_manage_admin_policy" ON public.employees;
CREATE POLICY "employees_manage_admin_policy" ON public.employees
  FOR ALL TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = auth.uid() LIMIT 1) = true
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager')
    )
  )
  WITH CHECK (
    (SELECT is_superadmin FROM public.employees WHERE user_id = auth.uid() LIMIT 1) = true
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager')
    )
  );
