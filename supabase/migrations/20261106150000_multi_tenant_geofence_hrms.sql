-- ==============================================================================
-- Migration: 20261106150000_multi_tenant_geofence_hrms.sql
-- Description: Complete Multi-Tenant Architecture, Background Geofencing & Work Locations,
--              Shifts, Devices, Audit & Retention, Attendance Exceptions & Monthly Summaries,
--              and Google Drive Archival tables.
-- Author: Principal Architect & Supabase Engineer
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 2. CORE SAAS: ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  logo_url text,
  plan_tier text NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'pro', 'enterprise')),
  max_employees integer NOT NULL DEFAULT 50,
  gps_retention_days integer NOT NULL DEFAULT 90,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- 3. SAAS MEMBERSHIP & RBAC: ORGANIZATION_MEMBERS
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'hr_manager', 'employee')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'invited')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- 4. WORK LOCATIONS & GEOFENCES
CREATE TABLE IF NOT EXISTS public.work_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL DEFAULT 150,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_locations_org ON public.work_locations(organization_id);

CREATE TABLE IF NOT EXISTS public.geofence_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.work_locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'circle' CHECK (zone_type IN ('circle', 'polygon')),
  polygon_coordinates jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofence_zones_loc ON public.geofence_zones(location_id);

-- 5. SHIFTS
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time without time zone NOT NULL DEFAULT '09:00:00',
  end_time time without time zone NOT NULL DEFAULT '18:00:00',
  late_grace_minutes integer NOT NULL DEFAULT 15,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_org ON public.shifts(organization_id);

-- 6. UPGRADE EXISTING ENTITIES (ADDITIVE)
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_org ON public.employees(organization_id);

ALTER TABLE public.departments 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_departments_org ON public.departments(organization_id);

-- 7. REGISTERED DEVICES & HARDWARE BINDINGS
CREATE TABLE IF NOT EXISTS public.registered_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  device_uuid text NOT NULL,
  device_model text,
  operating_system text,
  is_active boolean NOT NULL DEFAULT true,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, device_uuid)
);

CREATE INDEX IF NOT EXISTS idx_registered_devices_emp ON public.registered_devices(employee_id);
CREATE INDEX IF NOT EXISTS idx_registered_devices_uuid ON public.registered_devices(device_uuid);

-- 8. EMPLOYEE-TO-LOCATION ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.employee_location_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.work_locations(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_emp_location_emp ON public.employee_location_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_location_loc ON public.employee_location_assignments(location_id);

-- 9. EMPLOYEE-TO-SHIFT ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.employee_shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_shift_emp ON public.employee_shift_assignments(employee_id);

-- 10. TEMPORARY ROLLING GEOFENCE EVENTS (90-Day Retention)
CREATE TABLE IF NOT EXISTS public.geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('ENTER', 'EXIT', 'DWELL')),
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  is_mock boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_retention ON public.geofence_events(recorded_at);
CREATE INDEX IF NOT EXISTS idx_geofence_events_emp_time ON public.geofence_events(employee_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_org ON public.geofence_events(organization_id);

-- 11. UPGRADE ATTENDANCE TABLE WITH MULTI-TENANT & GEOFENCE COLUMNS
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS check_in_lat double precision,
  ADD COLUMN IF NOT EXISTS check_in_lon double precision,
  ADD COLUMN IF NOT EXISTS check_out_lat double precision,
  ADD COLUMN IF NOT EXISTS check_out_lon double precision,
  ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES public.registered_devices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_hours numeric(5,2),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON public.attendance(organization_id, date);

-- 12. ATTENDANCE EXCEPTIONS & REGULARIZATIONS
CREATE TABLE IF NOT EXISTS public.attendance_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.attendance(id) ON DELETE CASCADE,
  exception_type text NOT NULL CHECK (exception_type IN ('MISSED_CHECKOUT', 'OUTSIDE_GEOFENCE', 'LATE_ARRIVAL', 'EARLY_DEPARTURE')),
  reason text NOT NULL,
  regularization_status text NOT NULL DEFAULT 'pending' CHECK (regularization_status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.employees(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exceptions_status ON public.attendance_exceptions(organization_id, regularization_status);
CREATE INDEX IF NOT EXISTS idx_exceptions_emp ON public.attendance_exceptions(employee_id);

-- 13. CANONICAL MONTHLY SUMMARIES
CREATE TABLE IF NOT EXISTS public.attendance_monthly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  total_working_days integer NOT NULL,
  days_present integer NOT NULL DEFAULT 0,
  days_late integer NOT NULL DEFAULT 0,
  days_half_day integer NOT NULL DEFAULT 0,
  days_absent integer NOT NULL DEFAULT 0,
  days_on_leave integer NOT NULL DEFAULT 0,
  total_hours_worked numeric(7,2) NOT NULL DEFAULT 0,
  is_locked boolean NOT NULL DEFAULT false,
  pdf_archive_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_summary_lookup ON public.attendance_monthly_summaries(organization_id, year, month);

-- 14. GOOGLE DRIVE MULTI-TENANT ARCHIVAL MODULE
CREATE TABLE IF NOT EXISTS public.attendance_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token_encrypted text,
  root_folder_id text,
  auto_backup_enabled boolean NOT NULL DEFAULT true,
  last_archive_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.archive_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_files_expected integer NOT NULL DEFAULT 0,
  total_files_uploaded integer NOT NULL DEFAULT 0,
  manifest_sha256 text,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_jobs_org ON public.archive_jobs(organization_id, year, month);

CREATE TABLE IF NOT EXISTS public.archive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.archive_jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('master_summary', 'employee_report')),
  drive_file_id text NOT NULL,
  drive_web_link text,
  sha256_hash text NOT NULL,
  file_size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_files_job ON public.archive_files(job_id);

-- 15. UPGRADE REMAINING TABLES WITH ORGANIZATION_ID
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.leave_balances ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.holidays 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 16. SEED ROOT ORGANIZATION, DEFAULT LOCATION, AND DEFAULT SHIFT
DO $$
DECLARE
  v_root_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_default_loc_id uuid := '00000000-0000-0000-0000-000000000002';
  v_default_shift_id uuid := '00000000-0000-0000-0000-000000000003';
BEGIN
  -- Insert Root Organization if not exists
  INSERT INTO public.organizations (id, slug, name, legal_name, plan_tier, max_employees, gps_retention_days)
  VALUES (
    v_root_org_id,
    'fluxora-default',
    'Fluxora Technologies',
    'Fluxora Technologies Pvt. Ltd.',
    'enterprise',
    100,
    90
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    legal_name = EXCLUDED.legal_name,
    plan_tier = EXCLUDED.plan_tier;

  -- Insert Primary Office Location
  INSERT INTO public.work_locations (id, organization_id, name, address, latitude, longitude, radius_meters)
  VALUES (
    v_default_loc_id,
    v_root_org_id,
    'Fluxora HQ - Innovation Campus',
    'Senapati Bapat Road, Shivaji Nagar, Pune, Maharashtra 411016',
    18.5204,
    73.8567,
    150
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert Default General Shift
  INSERT INTO public.shifts (id, organization_id, name, start_time, end_time, late_grace_minutes)
  VALUES (
    v_default_shift_id,
    v_root_org_id,
    'General Shift (09:00 - 18:00)',
    '09:00:00',
    '18:00:00',
    15
  )
  ON CONFLICT (id) DO NOTHING;

  -- Backfill existing single-tenant data to root organization
  UPDATE public.employees 
  SET organization_id = v_root_org_id,
      work_location_id = COALESCE(work_location_id, v_default_loc_id),
      default_shift_id = COALESCE(default_shift_id, v_default_shift_id)
  WHERE organization_id IS NULL;

  UPDATE public.departments SET organization_id = v_root_org_id WHERE organization_id IS NULL;
  UPDATE public.attendance 
  SET organization_id = v_root_org_id,
      work_location_id = COALESCE(work_location_id, v_default_loc_id)
  WHERE organization_id IS NULL;

  UPDATE public.leave_requests SET organization_id = v_root_org_id WHERE organization_id IS NULL;
  UPDATE public.leave_balances SET organization_id = v_root_org_id WHERE organization_id IS NULL;
  UPDATE public.leave_types SET organization_id = v_root_org_id WHERE organization_id IS NULL;
  UPDATE public.holidays SET organization_id = v_root_org_id WHERE organization_id IS NULL;
  UPDATE public.documents SET organization_id = v_root_org_id WHERE organization_id IS NULL;
  UPDATE public.announcements SET organization_id = v_root_org_id WHERE organization_id IS NULL;
  UPDATE public.settings SET organization_id = v_root_org_id WHERE organization_id IS NULL;
  UPDATE public.audit_logs SET organization_id = v_root_org_id WHERE organization_id IS NULL;

  -- Backfill employee location assignments
  INSERT INTO public.employee_location_assignments (organization_id, employee_id, location_id, is_primary)
  SELECT v_root_org_id, e.id, v_default_loc_id, true
  FROM public.employees e
  ON CONFLICT (employee_id, location_id) DO NOTHING;

  -- Backfill organization_members from employees and user_roles (deduplicated by user_id)
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  SELECT 
    v_root_org_id,
    sub.user_id,
    sub.role,
    'active' AS status
  FROM (
    SELECT 
      e.user_id,
      CASE 
        WHEN e.is_superadmin = true THEN 'super_admin'
        WHEN bool_or(ur.role = 'admin') THEN 'org_admin'
        WHEN bool_or(ur.role = 'manager') THEN 'hr_manager'
        ELSE 'employee'
      END AS role
    FROM public.employees e
    LEFT JOIN public.user_roles ur ON ur.user_id = e.user_id
    WHERE e.user_id IS NOT NULL
    GROUP BY e.user_id, e.is_superadmin
  ) sub
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role;
END;
$$;

-- 17. REUSABLE HAVERSINE FORMULA (DISTANCE IN METERS)
CREATE OR REPLACE FUNCTION public.calculate_haversine_distance(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  r double precision := 6371000.0; -- Earth's mean radius in meters
  phi1 double precision := radians(lat1);
  phi2 double precision := radians(lat2);
  delta_phi double precision := radians(lat2 - lat1);
  delta_lambda double precision := radians(lon2 - lon1);
  a double precision;
  c double precision;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN 99999999.0;
  END IF;

  a := sin(delta_phi / 2.0) * sin(delta_phi / 2.0) +
       cos(phi1) * cos(phi2) *
       sin(delta_lambda / 2.0) * sin(delta_lambda / 2.0);
  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  RETURN r * c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_haversine_distance(double precision, double precision, double precision, double precision) TO authenticated, anon;

-- 18. MULTI-TENANT CONTEXT HELPERS
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = (select auth.uid())
    AND status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.has_org_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = (select auth.uid())
      AND status = 'active'
      AND (
        role = required_role
        OR role = 'super_admin'
        OR (required_role = 'hr_manager' AND role = 'org_admin')
        OR (required_role = 'employee' AND role IN ('org_admin', 'hr_manager'))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_org_role(text) TO authenticated;

-- 19. GEOFENCE CONTEXT QUERY RPC FOR FRONTEND
CREATE OR REPLACE FUNCTION public.get_employee_geofence_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := (select auth.uid());
  v_emp record;
  v_loc record;
  v_today_att record;
  v_shift record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthenticated');
  END IF;

  SELECT id, organization_id, full_name, work_location_id, default_shift_id
  INTO v_emp
  FROM public.employees
  WHERE user_id = v_user_id;

  IF v_emp.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Employee record not found for user');
  END IF;

  -- 1. Get primary assigned work location
  IF v_emp.work_location_id IS NOT NULL THEN
    SELECT * INTO v_loc FROM public.work_locations WHERE id = v_emp.work_location_id AND is_active = true;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT wl.* INTO v_loc
    FROM public.employee_location_assignments ela
    JOIN public.work_locations wl ON wl.id = ela.location_id
    WHERE ela.employee_id = v_emp.id AND wl.is_active = true
    ORDER BY ela.is_primary DESC
    LIMIT 1;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE organization_id = v_emp.organization_id AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- 2. Get today's attendance record
  SELECT * INTO v_today_att
  FROM public.attendance
  WHERE employee_id = v_emp.id AND date = CURRENT_DATE;

  -- 3. Get shift
  IF v_emp.default_shift_id IS NOT NULL THEN
    SELECT * INTO v_shift FROM public.shifts WHERE id = v_emp.default_shift_id;
  ELSE
    SELECT * INTO v_shift FROM public.shifts WHERE organization_id = v_emp.organization_id ORDER BY created_at ASC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'name', v_emp.full_name,
      'organization_id', v_emp.organization_id
    ),
    'location', CASE WHEN v_loc.id IS NOT NULL THEN jsonb_build_object(
      'id', v_loc.id,
      'name', v_loc.name,
      'address', v_loc.address,
      'latitude', v_loc.latitude,
      'longitude', v_loc.longitude,
      'radius_meters', v_loc.radius_meters
    ) ELSE NULL END,
    'today_attendance', CASE WHEN v_today_att.id IS NOT NULL THEN jsonb_build_object(
      'id', v_today_att.id,
      'check_in', v_today_att.check_in,
      'check_out', v_today_att.check_out,
      'status', v_today_att.status,
      'total_hours', v_today_att.total_hours
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

-- 20. CORE ATTENDANCE RPC (MANUAL GEOFENCE-GATED CHECK-IN / CHECK-OUT)
CREATE OR REPLACE FUNCTION public.verify_and_record_attendance(
  p_action text,
  p_lat double precision,
  p_lon double precision,
  p_accuracy double precision DEFAULT 10.0,
  p_device_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := (select auth.uid());
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
BEGIN
  -- Strict authentication check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Validate Action
  IF p_action NOT IN ('check_in', 'check_out') THEN
    RAISE EXCEPTION 'Invalid attendance action: %. Must be check_in or check_out.', p_action;
  END IF;

  -- Horizontal accuracy check (reject poor accuracy / GPS drift > 150m)
  IF p_accuracy IS NOT NULL AND p_accuracy > 150.0 THEN
    RAISE EXCEPTION 'GPS signal accuracy is too low (±%m). Please step into an open area or enable High Accuracy Location on your device.', round(p_accuracy::numeric, 1);
  END IF;

  -- Lookup employee record
  SELECT id, organization_id, full_name, work_location_id, default_shift_id
  INTO v_emp
  FROM public.employees
  WHERE user_id = v_user_id;

  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'No employee profile linked to user account %.', v_user_id;
  END IF;

  -- Lookup assigned location
  IF v_emp.work_location_id IS NOT NULL THEN
    SELECT * INTO v_loc FROM public.work_locations WHERE id = v_emp.work_location_id AND is_active = true;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT wl.* INTO v_loc
    FROM public.employee_location_assignments ela
    JOIN public.work_locations wl ON wl.id = ela.location_id
    WHERE ela.employee_id = v_emp.id AND wl.is_active = true
    ORDER BY ela.is_primary DESC
    LIMIT 1;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE organization_id = v_emp.organization_id AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_loc.id IS NULL THEN
    RAISE EXCEPTION 'No active work location assigned to employee or configured for organization.';
  END IF;

  -- Calculate distance to office geofence center
  v_dist := public.calculate_haversine_distance(p_lat, p_lon, v_loc.latitude, v_loc.longitude);
  v_max_radius := COALESCE(v_loc.radius_meters, 150);

  -- GEOFENCE GATING ENFORCEMENT
  IF v_dist > v_max_radius THEN
    -- Log out-of-bounds event
    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock
    ) VALUES (
      v_emp.organization_id, v_emp.id, v_loc.id, 'EXIT', p_lat, p_lon, p_accuracy, false
    );

    IF p_action = 'check_in' THEN
      RAISE EXCEPTION 'You are %m away from % (Allowed geofence radius: %m). Manual check-in is only permitted when you are physically inside the office geofence.', 
        round(v_dist::numeric, 1), v_loc.name, v_max_radius;
    ELSE
      RAISE EXCEPTION 'You are %m away from % (Allowed geofence radius: %m). Manual check-out is disabled when outside your assigned office geofence.', 
        round(v_dist::numeric, 1), v_loc.name, v_max_radius;
    END IF;
  END IF;

  -- Optional registered device binding
  IF p_device_id IS NOT NULL AND length(trim(p_device_id)) > 0 THEN
    SELECT id INTO v_reg_device_id
    FROM public.registered_devices
    WHERE employee_id = v_emp.id AND device_uuid = p_device_id;

    IF v_reg_device_id IS NULL THEN
      INSERT INTO public.registered_devices (employee_id, device_uuid, device_model)
      VALUES (v_emp.id, p_device_id, 'Web/Mobile Client')
      RETURNING id INTO v_reg_device_id;
    END IF;
  END IF;

  -- CHECK-IN FLOW
  IF p_action = 'check_in' THEN
    SELECT * INTO v_today_att
    FROM public.attendance
    WHERE employee_id = v_emp.id AND date = CURRENT_DATE;

    IF v_today_att.id IS NOT NULL AND v_today_att.check_in IS NOT NULL THEN
      RAISE EXCEPTION 'You are already checked in for today at %.', to_char(v_today_att.check_in, 'HH24:MI');
    END IF;

    -- Shift late evaluation
    IF v_emp.default_shift_id IS NOT NULL THEN
      SELECT * INTO v_shift FROM public.shifts WHERE id = v_emp.default_shift_id;
      IF v_shift.id IS NOT NULL AND CURRENT_TIME > (v_shift.start_time + (v_shift.late_grace_minutes || ' minutes')::interval) THEN
        v_status := 'late';
      END IF;
    END IF;

    IF v_today_att.id IS NOT NULL THEN
      UPDATE public.attendance
      SET check_in = now(),
          status = v_status::public.attendance_status,
          method = 'manual_geofence',
          work_location_id = v_loc.id,
          check_in_lat = p_lat,
          check_in_lon = p_lon,
          device_id = v_reg_device_id,
          updated_at = now()
      WHERE id = v_today_att.id
      RETURNING id INTO v_new_att_id;
    ELSE
      INSERT INTO public.attendance (
        organization_id, employee_id, date, check_in, status, method,
        work_location_id, check_in_lat, check_in_lon, device_id
      ) VALUES (
        v_emp.organization_id, v_emp.id, CURRENT_DATE, now(), v_status::public.attendance_status, 'manual_geofence',
        v_loc.id, p_lat, p_lon, v_reg_device_id
      )
      RETURNING id INTO v_new_att_id;
    END IF;

    -- Log verified geofence entry
    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock
    ) VALUES (
      v_emp.organization_id, v_emp.id, v_loc.id, 'ENTER', p_lat, p_lon, p_accuracy, false
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'check_in',
      'attendance_id', v_new_att_id,
      'time', now(),
      'status', v_status,
      'location_name', v_loc.name,
      'distance_meters', round(v_dist::numeric, 1)
    );

  -- CHECK-OUT FLOW
  ELSIF p_action = 'check_out' THEN
    SELECT * INTO v_today_att
    FROM public.attendance
    WHERE employee_id = v_emp.id AND date = CURRENT_DATE;

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
        updated_at = now()
    WHERE id = v_today_att.id;

    -- Log verified geofence exit event
    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock
    ) VALUES (
      v_emp.organization_id, v_emp.id, v_loc.id, 'EXIT', p_lat, p_lon, p_accuracy, false
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'check_out',
      'attendance_id', v_today_att.id,
      'time', now(),
      'total_hours', v_hours,
      'location_name', v_loc.name,
      'distance_meters', round(v_dist::numeric, 1)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_record_attendance(text, double precision, double precision, double precision, text) TO authenticated;

-- 21. ROLLING 90-DAY GPS CLEANUP FUNCTION
CREATE OR REPLACE FUNCTION public.cleanup_expired_gps_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.geofence_events ge
  USING public.organizations org
  WHERE ge.organization_id = org.id
    AND ge.recorded_at < now() - (COALESCE(org.gps_retention_days, 90) || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_gps_logs() TO authenticated;

-- 22. SECURITY & RLS POLICIES
-- Enable RLS on all newly created tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_monthly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_files ENABLE ROW LEVEL SECURITY;

-- Organizations policies
DROP POLICY IF EXISTS "org_read_members" ON public.organizations;
CREATE POLICY "org_read_members" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()))
    OR (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
  );

DROP POLICY IF EXISTS "org_admin_manage" ON public.organizations;
CREATE POLICY "org_admin_manage" ON public.organizations
  FOR ALL TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  )
  WITH CHECK (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  );

-- Organization members policies
DROP POLICY IF EXISTS "members_read_policy" ON public.organization_members;
CREATE POLICY "members_read_policy" ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()))
    OR (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
  );

DROP POLICY IF EXISTS "members_admin_manage" ON public.organization_members;
CREATE POLICY "members_admin_manage" ON public.organization_members
  FOR ALL TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  )
  WITH CHECK (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  );

-- Work locations policies
DROP POLICY IF EXISTS "work_locations_read" ON public.work_locations;
CREATE POLICY "work_locations_read" ON public.work_locations
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()))
    OR (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
  );

DROP POLICY IF EXISTS "work_locations_admin_manage" ON public.work_locations;
CREATE POLICY "work_locations_admin_manage" ON public.work_locations
  FOR ALL TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  )
  WITH CHECK (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  );

-- Shifts policies
DROP POLICY IF EXISTS "shifts_read" ON public.shifts;
CREATE POLICY "shifts_read" ON public.shifts
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()))
    OR (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
  );

DROP POLICY IF EXISTS "shifts_admin_manage" ON public.shifts;
CREATE POLICY "shifts_admin_manage" ON public.shifts
  FOR ALL TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  )
  WITH CHECK (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  );

-- Employee location assignments policies
DROP POLICY IF EXISTS "ela_read" ON public.employee_location_assignments;
CREATE POLICY "ela_read" ON public.employee_location_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()))
    OR (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
  );

DROP POLICY IF EXISTS "ela_admin_manage" ON public.employee_location_assignments;
CREATE POLICY "ela_admin_manage" ON public.employee_location_assignments
  FOR ALL TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  )
  WITH CHECK (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  );

-- Registered devices policies
DROP POLICY IF EXISTS "devices_owner_read" ON public.registered_devices;
CREATE POLICY "devices_owner_read" ON public.registered_devices
  FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = (select auth.uid()))
    OR (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
  );

-- Geofence events policies
DROP POLICY IF EXISTS "geofence_events_admin_read" ON public.geofence_events;
CREATE POLICY "geofence_events_admin_read" ON public.geofence_events
  FOR SELECT TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin', 'hr_manager'))
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = (select auth.uid()))
  );

-- Attendance exceptions policies
DROP POLICY IF EXISTS "exceptions_read" ON public.attendance_exceptions;
CREATE POLICY "exceptions_read" ON public.attendance_exceptions
  FOR SELECT TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "exceptions_insert" ON public.attendance_exceptions;
CREATE POLICY "exceptions_insert" ON public.attendance_exceptions
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = (select auth.uid()))
    OR (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
  );

DROP POLICY IF EXISTS "exceptions_admin_update" ON public.attendance_exceptions;
CREATE POLICY "exceptions_admin_update" ON public.attendance_exceptions
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin', 'hr_manager'))
  )
  WITH CHECK (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin', 'hr_manager'))
  );

-- Attendance monthly summaries policies
DROP POLICY IF EXISTS "monthly_summaries_read" ON public.attendance_monthly_summaries;
CREATE POLICY "monthly_summaries_read" ON public.attendance_monthly_summaries
  FOR SELECT TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()))
  );

-- Google Drive archives & jobs policies
DROP POLICY IF EXISTS "drive_archives_admin" ON public.attendance_archives;
CREATE POLICY "drive_archives_admin" ON public.attendance_archives
  FOR ALL TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  )
  WITH CHECK (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin'))
  );

DROP POLICY IF EXISTS "archive_jobs_admin" ON public.archive_jobs;
CREATE POLICY "archive_jobs_admin" ON public.archive_jobs
  FOR ALL TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin', 'hr_manager'))
  )
  WITH CHECK (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND role IN ('super_admin', 'org_admin', 'hr_manager'))
  );

DROP POLICY IF EXISTS "archive_files_read" ON public.archive_files;
CREATE POLICY "archive_files_read" ON public.archive_files
  FOR SELECT TO authenticated
  USING (
    (SELECT is_superadmin FROM public.employees WHERE user_id = (select auth.uid()) LIMIT 1) = true
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()))
  );

-- 23. BACKWARD-COMPATIBLE VIEW: attendance_sessions
CREATE OR REPLACE VIEW public.attendance_sessions WITH (security_invoker = true) AS
SELECT * FROM public.attendance;

-- 24. GRANT REST DATA API ACCESS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofence_zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registered_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_location_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_shift_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofence_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_exceptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_monthly_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_archives TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_files TO authenticated;
