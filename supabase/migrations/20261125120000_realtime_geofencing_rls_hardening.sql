-- ==============================================================================
-- FlowPeople — Supabase Realtime Geofencing & Multi-Tenant Security Hardening
-- ==============================================================================
-- 1. Hardens existing `public.work_locations` (created_by, constraints, trigger, indexes)
-- 2. Replaces permissive RLS policies on work_locations, attendance, geofence_events,
--    geofence_zones, and attendance_exceptions with strict organization isolation
-- 3. Drops client-side attendance insert/update bypass policies and record_geofence_punch()
-- 4. Enables Supabase Realtime replication on `public.work_locations` + safe
--    invalidation broadcast trigger when geofence configuration or status changes
-- 5. Hardens `save_office_location`, `delete_office_location`,
--    `get_employee_geofence_context`, `verify_and_record_attendance`, and
--    `cleanup_expired_gps_logs`
-- ==============================================================================

-- 1. HARDEN `public.work_locations` SCHEMA & CONSTRAINTS
ALTER TABLE public.work_locations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.work_locations
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_work_locations_org_active
  ON public.work_locations (organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_attendance_org_date
  ON public.attendance (organization_id, date);

CREATE INDEX IF NOT EXISTS idx_geofence_events_org_emp_time
  ON public.geofence_events (organization_id, employee_id, recorded_at DESC);

ALTER TABLE public.work_locations
  DROP CONSTRAINT IF EXISTS work_locations_latitude_check,
  DROP CONSTRAINT IF EXISTS work_locations_longitude_check,
  DROP CONSTRAINT IF EXISTS work_locations_radius_check,
  DROP CONSTRAINT IF EXISTS work_locations_active_coords_check;

ALTER TABLE public.work_locations
  ADD CONSTRAINT work_locations_latitude_check
    CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0)),
  ADD CONSTRAINT work_locations_longitude_check
    CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0)),
  ADD CONSTRAINT work_locations_radius_check
    CHECK (radius_meters > 0 AND radius_meters <= 50000),
  ADD CONSTRAINT work_locations_active_coords_check
    CHECK (is_active = false OR (latitude IS NOT NULL AND longitude IS NOT NULL));

CREATE OR REPLACE FUNCTION public.set_work_locations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_locations_updated_at ON public.work_locations;
CREATE TRIGGER trg_work_locations_updated_at
  BEFORE UPDATE ON public.work_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_work_locations_updated_at();

-- 2. MULTI-TENANT ROLE & MEMBERSHIP HELPERS (SECURITY DEFINER, SAFE SEARCH_PATH)
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND p_org_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = (SELECT auth.uid())
          AND om.organization_id = p_org_id
          AND om.status = 'active'
      )
      OR EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.user_id = (SELECT auth.uid())
          AND e.organization_id = p_org_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.user_id = (SELECT auth.uid())
          AND e.is_superadmin = true
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND p_org_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.user_id = (SELECT auth.uid())
          AND e.is_superadmin = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = (SELECT auth.uid())
          AND om.organization_id = p_org_id
          AND om.status = 'active'
          AND om.role IN ('super_admin', 'org_admin', 'hr_manager')
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = (SELECT auth.uid())
            AND ur.role::text IN ('admin', 'superadmin')
        )
        AND EXISTS (
          SELECT 1
          FROM public.employees e
          WHERE e.user_id = (SELECT auth.uid())
            AND e.organization_id = p_org_id
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;

-- 3. RLS HARDENING — WORK LOCATIONS (EMPLOYEES READ ACTIVE ORG GEOFENCES ONLY; ADMINS MANAGE OWN ORG)
ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_locations_read" ON public.work_locations;
DROP POLICY IF EXISTS "work_locations_admin_manage" ON public.work_locations;
DROP POLICY IF EXISTS "work_locations_employee_read_active" ON public.work_locations;
DROP POLICY IF EXISTS "work_locations_select_scoped" ON public.work_locations;
DROP POLICY IF EXISTS "work_locations_insert_admin" ON public.work_locations;
DROP POLICY IF EXISTS "work_locations_update_admin" ON public.work_locations;
DROP POLICY IF EXISTS "work_locations_delete_admin" ON public.work_locations;

CREATE POLICY "work_locations_select_scoped"
  ON public.work_locations
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND (
      is_active = true
      OR public.is_org_admin(organization_id)
    )
  );

CREATE POLICY "work_locations_insert_admin"
  ON public.work_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.is_org_admin(organization_id)
  );

CREATE POLICY "work_locations_update_admin"
  ON public.work_locations
  FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.is_org_admin(organization_id)
  );

CREATE POLICY "work_locations_delete_admin"
  ON public.work_locations
  FOR DELETE
  TO authenticated
  USING (public.is_org_admin(organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_locations TO authenticated;

-- 4. RLS HARDENING — GEOFENCE ZONES
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geofence_zones_read" ON public.geofence_zones;
DROP POLICY IF EXISTS "geofence_zones_manage" ON public.geofence_zones;
DROP POLICY IF EXISTS "geofence_zones_select_org" ON public.geofence_zones;
DROP POLICY IF EXISTS "geofence_zones_admin_manage" ON public.geofence_zones;

CREATE POLICY "geofence_zones_select_org"
  ON public.geofence_zones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.work_locations wl
      WHERE wl.id = geofence_zones.location_id
        AND public.is_org_member(wl.organization_id)
        AND (wl.is_active = true OR public.is_org_admin(wl.organization_id))
    )
  );

CREATE POLICY "geofence_zones_admin_manage"
  ON public.geofence_zones
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.work_locations wl
      WHERE wl.id = geofence_zones.location_id
        AND public.is_org_admin(wl.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.work_locations wl
      WHERE wl.id = geofence_zones.location_id
        AND public.is_org_admin(wl.organization_id)
    )
  );

-- 5. RLS HARDENING — ATTENDANCE (PREVENT DIRECT EMPLOYEE CLIENT INSERTS/UPDATES)
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sync_attendance_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.employee_id IS NOT NULL THEN
    SELECT e.organization_id
    INTO NEW.organization_id
    FROM public.employees e
    WHERE e.id = NEW.employee_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_sync_org ON public.attendance;
CREATE TRIGGER trg_attendance_sync_org
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_attendance_organization_id();

DROP POLICY IF EXISTS "attendance: employee insert own" ON public.attendance;
DROP POLICY IF EXISTS "attendance: employee update own" ON public.attendance;
DROP POLICY IF EXISTS "attendance: employee select own" ON public.attendance;
DROP POLICY IF EXISTS "attendance: admin all" ON public.attendance;
DROP POLICY IF EXISTS "attendance: manager team select and update" ON public.attendance;

CREATE POLICY "attendance: employee select own"
  ON public.attendance
  FOR SELECT
  TO authenticated
  USING (employee_id = public.current_employee_id());

CREATE POLICY "attendance: admin all"
  ON public.attendance
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin(
      COALESCE(
        organization_id,
        (SELECT e.organization_id FROM public.employees e WHERE e.id = employee_id)
      )
    )
  )
  WITH CHECK (
    public.is_org_admin(
      COALESCE(
        organization_id,
        (SELECT e.organization_id FROM public.employees e WHERE e.id = employee_id)
      )
    )
  );

CREATE POLICY "attendance: manager team select and update"
  ON public.attendance
  FOR ALL
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
    AND public.is_org_member(
      COALESCE(
        organization_id,
        (SELECT e.organization_id FROM public.employees e WHERE e.id = employee_id)
      )
    )
    AND (public.is_my_team_member(employee_id) OR employee_id = public.current_employee_id())
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
    AND public.is_org_member(
      COALESCE(
        organization_id,
        (SELECT e.organization_id FROM public.employees e WHERE e.id = employee_id)
      )
    )
    AND public.is_my_team_member(employee_id)
  );

-- 6. RLS HARDENING — GEOFENCE EVENTS (NO DIRECT CLIENT WRITES; ORG-ISOLATED SELECT)
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geofence_events_authenticated_select" ON public.geofence_events;
DROP POLICY IF EXISTS "geofence_events_authenticated_insert" ON public.geofence_events;
DROP POLICY IF EXISTS "geofence_events_read" ON public.geofence_events;
DROP POLICY IF EXISTS "geofence_events_insert" ON public.geofence_events;
DROP POLICY IF EXISTS "geofence_events_select_org" ON public.geofence_events;

CREATE POLICY "geofence_events_select_org"
  ON public.geofence_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(organization_id)
    OR (
      employee_id = public.current_employee_id()
      AND public.is_org_member(organization_id)
    )
  );

-- 7. RLS HARDENING — ATTENDANCE EXCEPTIONS (DROP WIDE-OPEN ALL POLICY)
ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_exceptions_authenticated_all" ON public.attendance_exceptions;
DROP POLICY IF EXISTS "exceptions_insert" ON public.attendance_exceptions;
DROP POLICY IF EXISTS "exceptions_read" ON public.attendance_exceptions;
DROP POLICY IF EXISTS "exceptions_admin_update" ON public.attendance_exceptions;

CREATE POLICY "exceptions_read"
  ON public.attendance_exceptions
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(organization_id)
    OR (
      employee_id = public.current_employee_id()
      AND public.is_org_member(organization_id)
    )
  );

CREATE POLICY "exceptions_insert"
  ON public.attendance_exceptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND (
      employee_id = public.current_employee_id()
      OR public.is_org_admin(organization_id)
    )
  );

CREATE POLICY "exceptions_admin_update"
  ON public.attendance_exceptions
  FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- 8. REALTIME CONFIGURATION ON `public.work_locations`
ALTER TABLE public.work_locations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'work_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.work_locations;
  END IF;
END;
$$;

-- Safe non-PII invalidation signal via Realtime Broadcast so employees also
-- immediately learn if HR/Admin deactivates or deletes their office geofence.
CREATE OR REPLACE FUNCTION public.broadcast_work_location_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime, pg_temp
AS $$
DECLARE
  v_org_id uuid := COALESCE(NEW.organization_id, OLD.organization_id);
  v_loc_id uuid := COALESCE(NEW.id, OLD.id);
BEGIN
  IF v_org_id IS NOT NULL THEN
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object(
          'operation', TG_OP,
          'location_id', v_loc_id,
          'is_active', COALESCE(NEW.is_active, false),
          'updated_at', now()
        ),
        'geofence_changed',
        'org:' || v_org_id::text || ':geofence',
        false
      );
    EXCEPTION WHEN OTHERS THEN
      -- Never block DML if Realtime extension is unavailable in local/test DB
      NULL;
    END;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_work_locations_realtime_broadcast ON public.work_locations;
CREATE TRIGGER trg_work_locations_realtime_broadcast
  AFTER INSERT OR UPDATE OR DELETE ON public.work_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_work_location_change();

-- 9. RETIRE INSECURE CLIENT BYPASS RPC
DROP FUNCTION IF EXISTS public.record_geofence_punch(double precision, double precision, uuid, double precision);

-- 10. HARDENED ADMIN LOCATION RPCs
CREATE OR REPLACE FUNCTION public.save_office_location(
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lon double precision DEFAULT NULL,
  p_radius integer DEFAULT 150,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_org_id uuid;
  v_loc record;
  v_clean_name text := NULLIF(trim(COALESCE(p_name, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF v_clean_name IS NULL THEN
    RAISE EXCEPTION 'Office name is required.';
  END IF;

  IF p_lat IS NULL OR p_lon IS NULL OR p_lat < -90.0 OR p_lat > 90.0 OR p_lon < -180.0 OR p_lon > 180.0 THEN
    RAISE EXCEPTION 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required.';
  END IF;

  IF p_radius IS NULL OR p_radius <= 0 OR p_radius > 50000 THEN
    RAISE EXCEPTION 'Geofence radius must be greater than 0 and at most 50000 meters.';
  END IF;

  SELECT COALESCE(
    (SELECT e.organization_id FROM public.employees e WHERE e.user_id = v_user_id AND e.organization_id IS NOT NULL LIMIT 1),
    (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = v_user_id AND om.status = 'active' LIMIT 1)
  ) INTO v_org_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization membership found for administrator.';
  END IF;

  IF NOT public.is_org_admin(v_org_id) THEN
    RAISE EXCEPTION 'Forbidden: only authorized HR/Admin users can configure office geofences.'
      USING ERRCODE = '42501';
  END IF;

  IF p_id IS NOT NULL THEN
    SELECT organization_id INTO v_loc FROM public.work_locations WHERE id = p_id;
    IF v_loc IS NOT NULL THEN
      IF NOT public.is_org_admin(v_loc.organization_id) THEN
        RAISE EXCEPTION 'Forbidden: cannot modify another organization geofence.'
          USING ERRCODE = '42501';
      END IF;

      UPDATE public.work_locations
      SET name = v_clean_name,
          address = NULLIF(trim(COALESCE(p_address, '')), ''),
          latitude = p_lat,
          longitude = p_lon,
          radius_meters = p_radius,
          is_active = COALESCE(p_is_active, true),
          updated_at = now()
      WHERE id = p_id
      RETURNING * INTO v_loc;
    ELSE
      INSERT INTO public.work_locations (
        id, organization_id, name, address, latitude, longitude, radius_meters, is_active, created_by, created_at, updated_at
      ) VALUES (
        p_id, v_org_id, v_clean_name, NULLIF(trim(COALESCE(p_address, '')), ''), p_lat, p_lon, p_radius, COALESCE(p_is_active, true), v_user_id, now(), now()
      )
      RETURNING * INTO v_loc;
    END IF;
  ELSE
    INSERT INTO public.work_locations (
      organization_id, name, address, latitude, longitude, radius_meters, is_active, created_by, created_at, updated_at
    ) VALUES (
      v_org_id, v_clean_name, NULLIF(trim(COALESCE(p_address, '')), ''), p_lat, p_lon, p_radius, COALESCE(p_is_active, true), v_user_id, now(), now()
    )
    RETURNING * INTO v_loc;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_loc.id,
    'organization_id', v_loc.organization_id,
    'name', v_loc.name,
    'address', v_loc.address,
    'latitude', v_loc.latitude,
    'longitude', v_loc.longitude,
    'radius_meters', v_loc.radius_meters,
    'is_active', v_loc.is_active,
    'created_by', v_loc.created_by,
    'updated_at', v_loc.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_office_location(uuid, text, text, double precision, double precision, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_office_location(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_target_org_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT organization_id INTO v_target_org_id
  FROM public.work_locations
  WHERE id = p_id;

  IF v_target_org_id IS NULL THEN
    RAISE EXCEPTION 'Work location not found.';
  END IF;

  IF NOT public.is_org_admin(v_target_org_id) THEN
    RAISE EXCEPTION 'Forbidden: only authorized HR/Admin users can delete office geofences.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.employees SET work_location_id = NULL WHERE work_location_id = p_id;
  DELETE FROM public.employee_location_assignments WHERE location_id = p_id;
  DELETE FROM public.work_locations WHERE id = p_id;

  RETURN jsonb_build_object('success', true, 'deleted_id', p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_office_location(uuid) TO authenticated;

-- 11. STRICTLY ORG-SCOPED EMPLOYEE GEOFENCE CONTEXT RPC
CREATE OR REPLACE FUNCTION public.get_employee_geofence_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_emp record;
  v_loc record;
  v_today_att record;
  v_shift record;
  v_org_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthenticated');
  END IF;

  SELECT id, organization_id, full_name, work_location_id, default_shift_id
  INTO v_emp
  FROM public.employees
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_emp.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Employee record not found for user');
  END IF;

  v_org_id := COALESCE(
    v_emp.organization_id,
    (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = v_user_id AND om.status = 'active' LIMIT 1)
  );

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Employee is not linked to an organization');
  END IF;

  -- Strictly look up active geofence within the employee's OWN organization only.
  IF v_emp.work_location_id IS NOT NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE id = v_emp.work_location_id
      AND organization_id = v_org_id
      AND is_active = true;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT wl.* INTO v_loc
    FROM public.employee_location_assignments ela
    JOIN public.work_locations wl ON wl.id = ela.location_id
    WHERE ela.employee_id = v_emp.id
      AND wl.organization_id = v_org_id
      AND wl.is_active = true
    ORDER BY ela.is_primary DESC, wl.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE organization_id = v_org_id
      AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  SELECT * INTO v_today_att
  FROM public.attendance
  WHERE employee_id = v_emp.id AND date = CURRENT_DATE;

  IF v_emp.default_shift_id IS NOT NULL THEN
    SELECT * INTO v_shift FROM public.shifts WHERE id = v_emp.default_shift_id AND organization_id = v_org_id;
  ELSE
    SELECT * INTO v_shift FROM public.shifts WHERE organization_id = v_org_id ORDER BY created_at ASC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'name', v_emp.full_name,
      'organization_id', v_org_id
    ),
    'location', CASE WHEN v_loc.id IS NOT NULL THEN jsonb_build_object(
      'id', v_loc.id,
      'organization_id', v_loc.organization_id,
      'name', v_loc.name,
      'address', v_loc.address,
      'latitude', v_loc.latitude,
      'longitude', v_loc.longitude,
      'radius_meters', v_loc.radius_meters,
      'is_active', v_loc.is_active,
      'updated_at', v_loc.updated_at
    ) ELSE NULL END,
    'today_attendance', CASE WHEN v_today_att.id IS NOT NULL THEN jsonb_build_object(
      'id', v_today_att.id,
      'check_in', v_today_att.check_in,
      'check_out', v_today_att.check_out,
      'status', v_today_att.status,
      'total_hours', COALESCE(v_today_att.total_hours, v_today_att.working_hours)
    ) ELSE NULL END,
    'shift', CASE WHEN v_shift.id IS NOT NULL THEN jsonb_build_object(
      'name', v_shift.name,
      'start_time', v_shift.start_time,
      'end_time', v_shift.end_time
    ) ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_geofence_context() TO authenticated;

-- 12. HARDENED BACKUP VERIFICATION RPC (IN ADDITION TO PRIMARY EDGE FUNCTION `verify-attendance`)
CREATE OR REPLACE FUNCTION public.verify_and_record_attendance(
  p_action text,
  p_lat double precision,
  p_lon double precision,
  p_accuracy double precision DEFAULT NULL,
  p_device_id text DEFAULT NULL,
  p_location_source text DEFAULT 'browser_gps'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_emp record;
  v_loc record;
  v_shift record;
  v_dist double precision;
  v_max_radius integer;
  v_today_att record;
  v_hours numeric(5,2);
  v_status text := 'present';
  v_new_att_id uuid;
  v_reg_device_id uuid;
  v_source text := COALESCE(NULLIF(trim(p_location_source), ''), 'browser_gps');
  v_org_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_action NOT IN ('check_in', 'check_out') THEN
    RAISE EXCEPTION 'Invalid attendance action: %. Must be check_in or check_out.', p_action;
  END IF;

  IF p_lat IS NULL OR p_lon IS NULL OR p_lat < -90.0 OR p_lat > 90.0 OR p_lon < -180.0 OR p_lon > 180.0 THEN
    RAISE EXCEPTION 'Invalid GPS coordinates provided.';
  END IF;

  IF p_accuracy IS NULL OR p_accuracy <= 0 OR p_accuracy > 150.0 THEN
    RAISE EXCEPTION 'GPS accuracy (±%m) does not meet the 150m precision threshold.', COALESCE(round(p_accuracy::numeric, 1)::text, 'unknown');
  END IF;

  SELECT id, organization_id, full_name, work_location_id, default_shift_id
  INTO v_emp
  FROM public.employees
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'No employee profile linked to user account.';
  END IF;

  v_org_id := COALESCE(
    v_emp.organization_id,
    (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = v_user_id AND om.status = 'active' LIMIT 1)
  );

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Employee organization membership not found.';
  END IF;

  IF v_emp.work_location_id IS NOT NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE id = v_emp.work_location_id
      AND organization_id = v_org_id
      AND is_active = true;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT wl.* INTO v_loc
    FROM public.employee_location_assignments ela
    JOIN public.work_locations wl ON wl.id = ela.location_id
    WHERE ela.employee_id = v_emp.id
      AND wl.organization_id = v_org_id
      AND wl.is_active = true
    ORDER BY ela.is_primary DESC, wl.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE organization_id = v_org_id
      AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_loc.id IS NULL THEN
    RAISE EXCEPTION 'No active Main Office geofence configured for your organization.';
  END IF;

  v_dist := public.calculate_haversine_distance(p_lat, p_lon, v_loc.latitude, v_loc.longitude);
  v_max_radius := COALESCE(v_loc.radius_meters, 150);

  IF p_action = 'check_in' AND v_dist > v_max_radius THEN
    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock, location_source
    ) VALUES (
      v_org_id, v_emp.id, v_loc.id, 'EXIT', p_lat, p_lon, p_accuracy, false, v_source
    );

    RAISE EXCEPTION 'You are %m away from % (Allowed radius: %m). Check-in is only enabled inside the office geofence.',
      round(v_dist::numeric, 1), v_loc.name, v_max_radius;
  END IF;

  IF p_device_id IS NOT NULL AND length(trim(p_device_id)) > 0 THEN
    SELECT id INTO v_reg_device_id
    FROM public.registered_devices
    WHERE employee_id = v_emp.id AND device_uuid = p_device_id
    LIMIT 1;

    IF v_reg_device_id IS NULL THEN
      INSERT INTO public.registered_devices (employee_id, device_uuid, device_model)
      VALUES (v_emp.id, p_device_id, 'Web/Mobile Client')
      RETURNING id INTO v_reg_device_id;
    END IF;
  END IF;

  -- Serialize concurrent check-in/out requests per employee per day
  PERFORM pg_advisory_xact_lock(hashtext(v_emp.id::text || ':' || CURRENT_DATE::text));

  -- Lock existing daily row if present to guard against double-tap concurrency
  SELECT * INTO v_today_att
  FROM public.attendance
  WHERE employee_id = v_emp.id AND date = CURRENT_DATE
  FOR UPDATE;

  IF p_action = 'check_in' THEN
    IF v_today_att.id IS NOT NULL AND v_today_att.check_in IS NOT NULL THEN
      RAISE EXCEPTION 'You are already checked in for today at %.', to_char(v_today_att.check_in, 'HH24:MI');
    END IF;

    IF v_emp.default_shift_id IS NOT NULL THEN
      SELECT * INTO v_shift FROM public.shifts WHERE id = v_emp.default_shift_id AND organization_id = v_org_id;
      IF v_shift.id IS NOT NULL AND CURRENT_TIME > (v_shift.start_time + (COALESCE(v_shift.late_grace_minutes, v_shift.grace_period_minutes, 15) || ' minutes')::interval) THEN
        v_status := 'late';
      END IF;
    END IF;

    IF v_today_att.id IS NOT NULL THEN
      UPDATE public.attendance
      SET check_in = now(),
          status = v_status::public.attendance_status,
          method = 'geofence',
          work_location_id = v_loc.id,
          check_in_lat = p_lat,
          check_in_lon = p_lon,
          device_id = v_reg_device_id,
          location_source = v_source,
          updated_at = now()
      WHERE id = v_today_att.id
      RETURNING id INTO v_new_att_id;
    ELSE
      INSERT INTO public.attendance (
        organization_id, employee_id, date, check_in, status, method,
        work_location_id, check_in_lat, check_in_lon, device_id, location_source
      ) VALUES (
        v_org_id, v_emp.id, CURRENT_DATE, now(), v_status::public.attendance_status, 'geofence',
        v_loc.id, p_lat, p_lon, v_reg_device_id, v_source
      )
      RETURNING id INTO v_new_att_id;
    END IF;

    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock, location_source
    ) VALUES (
      v_org_id, v_emp.id, v_loc.id, 'ENTER', p_lat, p_lon, p_accuracy, false, v_source
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'check_in',
      'attendance_id', v_new_att_id,
      'time', now(),
      'status', v_status,
      'location_name', v_loc.name,
      'distance_meters', round(v_dist::numeric, 1),
      'source', v_source
    );
  ELSE
    IF v_today_att.id IS NULL OR v_today_att.check_in IS NULL THEN
      RAISE EXCEPTION 'Cannot check out: You have not checked in for today yet.';
    END IF;

    IF v_today_att.check_out IS NOT NULL THEN
      RAISE EXCEPTION 'You have already checked out for today at %.', to_char(v_today_att.check_out, 'HH24:MI');
    END IF;

    v_hours := round((EXTRACT(EPOCH FROM (now() - v_today_att.check_in)) / 3600.0)::numeric, 2);

    UPDATE public.attendance
    SET check_out = now(),
        check_out_lat = p_lat,
        check_out_lon = p_lon,
        total_hours = v_hours,
        working_hours = v_hours,
        location_source = v_source,
        updated_at = now()
    WHERE id = v_today_att.id;

    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock, location_source
    ) VALUES (
      v_org_id, v_emp.id, v_loc.id, 'EXIT', p_lat, p_lon, p_accuracy, false, v_source
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'check_out',
      'attendance_id', v_today_att.id,
      'time', now(),
      'total_hours', v_hours,
      'location_name', v_loc.name,
      'distance_meters', round(v_dist::numeric, 1),
      'source', v_source
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_record_attendance(text, double precision, double precision, double precision, text, text) TO authenticated;

-- 13. RESTRICT CLEANUP RPC TO SERVICE ROLE OR SUPERADMIN
CREATE OR REPLACE FUNCTION public.cleanup_expired_gps_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_deleted integer;
BEGIN
  IF v_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.employees e WHERE e.user_id = v_user_id AND e.is_superadmin = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: only system scheduler or superadmin can execute cleanup.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.geofence_events ge
  USING public.organizations org
  WHERE ge.organization_id = org.id
    AND ge.recorded_at < now() - (COALESCE(org.gps_retention_days, 90) || ' days')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_gps_logs() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_gps_logs() TO service_role;
