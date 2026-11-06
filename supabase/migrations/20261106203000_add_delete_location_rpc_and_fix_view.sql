-- 20261106203000_add_delete_location_rpc_and_fix_view.sql
-- Add delete_office_location RPC and ensure public read on work_locations for authenticated users

-- 1. Ensure all authenticated users can read company work locations
DROP POLICY IF EXISTS "work_locations_read" ON public.work_locations;
CREATE POLICY "work_locations_read" ON public.work_locations
FOR SELECT TO authenticated
USING (true);

-- 2. Add delete_office_location RPC
CREATE OR REPLACE FUNCTION public.delete_office_location(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id uuid := (select auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_admin_or_superadmin() THEN
    RAISE EXCEPTION 'Unauthorized: Only Admins can delete office locations.';
  END IF;

  -- Clean up assignments first (safety)
  UPDATE public.employees SET work_location_id = NULL WHERE work_location_id = p_id;
  DELETE FROM public.employee_location_assignments WHERE location_id = p_id;

  -- Delete work location
  DELETE FROM public.work_locations WHERE id = p_id;

  RETURN jsonb_build_object('success', true, 'deleted_id', p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_office_location TO authenticated;
