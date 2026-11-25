-- ==============================================================================
-- Migration: 20261106160000_location_studio_and_map_enhancements.sql
-- Description: Adds updated_at column to work_locations, staff assignment RPC,
--              and location statistics view for Admin Location Studio.
-- Author: Principal Architect & GIS Engineer
-- ==============================================================================

-- 1. Ensure updated_at column on work_locations
ALTER TABLE public.work_locations 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Staff Assignment RPC Function
CREATE OR REPLACE FUNCTION public.assign_employees_to_work_location(
  p_location_id uuid,
  p_employee_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := (select auth.uid());
  v_org_id uuid;
  v_count integer := 0;
  v_emp_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Validate caller has org_admin or super_admin role for this location's organization
  SELECT organization_id INTO v_org_id
  FROM public.work_locations
  WHERE id = p_location_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Work location not found.';
  END IF;

  IF NOT (
    (SELECT is_superadmin FROM public.employees WHERE user_id = v_user_id LIMIT 1) = true
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = v_user_id AND organization_id = v_org_id AND role IN ('super_admin', 'org_admin')
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only organization administrators can assign staff locations.';
  END IF;

  -- Loop through employee IDs
  IF p_employee_ids IS NOT NULL AND array_length(p_employee_ids, 1) > 0 THEN
    FOREACH v_emp_id IN ARRAY p_employee_ids
    LOOP
      -- Update employee default work location
      UPDATE public.employees
      SET work_location_id = p_location_id
      WHERE id = v_emp_id AND organization_id = v_org_id;

      -- Upsert primary location assignment
      INSERT INTO public.employee_location_assignments (
        organization_id, employee_id, location_id, is_primary
      ) VALUES (
        v_org_id, v_emp_id, p_location_id, true
      )
      ON CONFLICT (employee_id, location_id) DO UPDATE SET is_primary = true;

      -- Demote other location assignments for this employee to non-primary
      UPDATE public.employee_location_assignments
      SET is_primary = false
      WHERE employee_id = v_emp_id AND location_id <> p_location_id;

      v_count := v_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'assigned_count', v_count,
    'location_id', p_location_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_employees_to_work_location(uuid, uuid[]) TO authenticated;

-- 3. Location Stats View (including assigned employee count)
CREATE OR REPLACE VIEW public.work_location_stats WITH (security_invoker = true) AS
SELECT 
  wl.id,
  wl.organization_id,
  wl.name,
  wl.address,
  wl.latitude,
  wl.longitude,
  wl.radius_meters,
  wl.is_active,
  wl.created_at,
  wl.updated_at,
  COUNT(DISTINCT e.id)::integer AS assigned_employee_count
FROM public.work_locations wl
LEFT JOIN public.employees e ON e.work_location_id = wl.id
GROUP BY 
  wl.id,
  wl.organization_id,
  wl.name,
  wl.address,
  wl.latitude,
  wl.longitude,
  wl.radius_meters,
  wl.is_active,
  wl.created_at,
  wl.updated_at;

GRANT SELECT ON public.work_location_stats TO authenticated;

