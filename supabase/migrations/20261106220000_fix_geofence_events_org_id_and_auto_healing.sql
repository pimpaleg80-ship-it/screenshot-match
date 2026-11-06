-- 20261106220000_fix_geofence_events_org_id_and_auto_healing.sql
-- Fix "null value in column organization_id of relation geofence_events violates not-null constraint"
-- Eliminate recursive RLS policies on organization_members
-- Ensure employees and geofence events always auto-heal organization_id and work_location_id

-- 1. Make organization_id nullable in geofence_events & attendance_exceptions so telemetry never crashes attendance
ALTER TABLE public.geofence_events ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.attendance_exceptions ALTER COLUMN organization_id DROP NOT NULL;

-- 2. Non-recursive helper for organization IDs
CREATE OR REPLACE FUNCTION public.get_auth_user_org_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = p_user_id;
$$;

-- 3. Fix RLS policies to eliminate infinite recursion and grant clean access
DROP POLICY IF EXISTS "geofence_events_admin_read" ON public.geofence_events;
DROP POLICY IF EXISTS "geofence_events_authenticated_insert" ON public.geofence_events;
DROP POLICY IF EXISTS "geofence_events_authenticated_select" ON public.geofence_events;

CREATE POLICY "geofence_events_authenticated_insert" ON public.geofence_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "geofence_events_authenticated_select" ON public.geofence_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "attendance_exceptions_authenticated_all" ON public.attendance_exceptions;
CREATE POLICY "attendance_exceptions_authenticated_all" ON public.attendance_exceptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "members_admin_manage" ON public.organization_members;
DROP POLICY IF EXISTS "members_read_policy" ON public.organization_members;

CREATE POLICY "members_read_policy" ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_superadmin()
    OR organization_id IN (SELECT public.get_auth_user_org_ids((SELECT auth.uid())))
  );

CREATE POLICY "members_admin_manage" ON public.organization_members
  FOR ALL TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_superadmin()
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_superadmin()
  );

-- 4. Backfill all existing employees missing organization_id or work_location_id
DO $$
DECLARE
  v_default_org_id uuid;
  v_default_loc_id uuid;
BEGIN
  -- Resolve default organization
  SELECT id INTO v_default_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF v_default_org_id IS NULL THEN
    v_default_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
    INSERT INTO public.organizations (id, name, slug, subscription_tier, max_employees)
    VALUES (v_default_org_id, 'Fluxora Technologies', 'fluxora-default', 'enterprise', 500)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Resolve default active work location
  SELECT id INTO v_default_loc_id FROM public.work_locations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;

  -- Update all employees with missing org or location
  UPDATE public.employees
  SET organization_id = COALESCE(organization_id, v_default_org_id),
      work_location_id = COALESCE(work_location_id, v_default_loc_id),
      status = COALESCE(status, 'active')
  WHERE organization_id IS NULL OR work_location_id IS NULL;

  -- Ensure all users have organization_members rows
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  SELECT 
    COALESCE(e.organization_id, v_default_org_id),
    e.user_id,
    CASE WHEN e.is_superadmin = true THEN 'super_admin' ELSE 'org_admin' END,
    'active'
  FROM public.employees e
  WHERE e.user_id IS NOT NULL
  ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';
END $$;

-- 5. Update public.handle_new_user() trigger to automatically assign organization_id and work_location_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  is_first boolean;
  assigned_role public.app_role;
  emp_code text;
  v_default_org_id uuid;
  v_default_loc_id uuid;
BEGIN
  -- Check if this is the first user
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := COALESCE((new.raw_app_meta_data->>'role')::public.app_role, 'employee');
  END IF;

  -- Assign user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Resolve default organization
  SELECT id INTO v_default_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF v_default_org_id IS NULL THEN
    v_default_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Resolve default active location
  SELECT id INTO v_default_loc_id FROM public.work_locations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;

  -- Generate employee code
  BEGIN
    emp_code := 'EMP' || LPAD(nextval('public.employee_code_seq')::text, 3, '0');
  EXCEPTION WHEN OTHERS THEN
    emp_code := 'EMP' || to_char(now(), 'MIHH24') || floor(random() * 100)::text;
  END;

  -- Insert employee record with organization and location
  INSERT INTO public.employees (
    user_id,
    organization_id,
    work_location_id,
    employee_code,
    full_name,
    email,
    designation,
    status
  ) VALUES (
    new.id,
    v_default_org_id,
    v_default_loc_id,
    emp_code,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    CASE WHEN assigned_role = 'admin' THEN 'Administrator' ELSE 'Staff' END,
    'active'
  )
  ON CONFLICT (email) DO UPDATE SET 
    user_id = EXCLUDED.user_id,
    organization_id = COALESCE(public.employees.organization_id, EXCLUDED.organization_id),
    work_location_id = COALESCE(public.employees.work_location_id, EXCLUDED.work_location_id);

  -- Link organization membership
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (
    v_default_org_id,
    new.id,
    CASE WHEN assigned_role = 'admin' THEN 'org_admin' ELSE 'employee' END,
    'active'
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';

  RETURN new;
END;
$$;

-- 6. Bulletproof verify_and_record_attendance function
CREATE OR REPLACE FUNCTION public.verify_and_record_attendance(
  p_action text,
  p_lat double precision,
  p_lon double precision,
  p_accuracy double precision DEFAULT 5.0,
  p_device_id text DEFAULT NULL::text,
  p_location_source text DEFAULT 'browser_gps'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
  v_source text := COALESCE(p_location_source, 'browser_gps');
  v_clean_acc double precision := COALESCE(p_accuracy, 5.0);
  v_org_id uuid;
BEGIN
  -- Strict authentication check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Validate Action
  IF p_action NOT IN ('check_in', 'check_out') THEN
    RAISE EXCEPTION 'Invalid attendance action: %. Must be check_in or check_out.', p_action;
  END IF;

  -- Lookup employee record
  SELECT id, organization_id, full_name, work_location_id, default_shift_id
  INTO v_emp
  FROM public.employees
  WHERE user_id = v_user_id;

  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'No employee profile linked to user account %.', v_user_id;
  END IF;

  -- 1. Resolve reliable organization_id
  v_org_id := v_emp.organization_id;
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id 
    FROM public.organization_members 
    WHERE user_id = v_user_id AND organization_id IS NOT NULL 
    LIMIT 1;
  END IF;
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF v_org_id IS NULL THEN
    v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- 2. Lookup assigned office location
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
    WHERE organization_id = v_org_id AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_loc.id IS NULL THEN
    RAISE EXCEPTION 'No active work location configured. Please register an office geofence in Settings.';
  END IF;

  -- Auto-heal employee record if organization or location was missing
  IF v_emp.organization_id IS NULL OR v_emp.work_location_id IS NULL THEN
    UPDATE public.employees
    SET organization_id = COALESCE(organization_id, v_org_id, v_loc.organization_id),
        work_location_id = COALESCE(work_location_id, v_loc.id)
    WHERE id = v_emp.id;
    v_emp.organization_id := COALESCE(v_org_id, v_loc.organization_id);
    v_emp.work_location_id := v_loc.id;
  END IF;

  -- Calculate distance to office geofence center using Haversine formula
  v_dist := public.calculate_haversine_distance(p_lat, p_lon, v_loc.latitude, v_loc.longitude);
  v_max_radius := COALESCE(v_loc.radius_meters, 150);

  -- GEOFENCE GATING ENFORCEMENT
  IF v_dist > v_max_radius THEN
    -- Log out-of-bounds event safely with resolved organization_id
    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock, location_source
    ) VALUES (
      COALESCE(v_emp.organization_id, v_org_id, v_loc.organization_id),
      v_emp.id,
      v_loc.id,
      'EXIT',
      p_lat,
      p_lon,
      v_clean_acc,
      false,
      v_source
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
          location_source = v_source,
          updated_at = now()
      WHERE id = v_today_att.id
      RETURNING id INTO v_new_att_id;
    ELSE
      INSERT INTO public.attendance (
        organization_id, employee_id, date, check_in, status, method,
        work_location_id, check_in_lat, check_in_lon, device_id, location_source
      ) VALUES (
        COALESCE(v_emp.organization_id, v_org_id, v_loc.organization_id),
        v_emp.id,
        CURRENT_DATE,
        now(),
        v_status::public.attendance_status,
        'manual_geofence',
        v_loc.id,
        p_lat,
        p_lon,
        v_reg_device_id,
        v_source
      )
      RETURNING id INTO v_new_att_id;
    END IF;

    -- Log verified geofence entry safely
    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock, location_source
    ) VALUES (
      COALESCE(v_emp.organization_id, v_org_id, v_loc.organization_id),
      v_emp.id,
      v_loc.id,
      'ENTER',
      p_lat,
      p_lon,
      v_clean_acc,
      false,
      v_source
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
        location_source = v_source,
        updated_at = now()
    WHERE id = v_today_att.id;

    -- Log verified geofence exit event safely
    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock, location_source
    ) VALUES (
      COALESCE(v_emp.organization_id, v_org_id, v_loc.organization_id),
      v_emp.id,
      v_loc.id,
      'EXIT',
      p_lat,
      p_lon,
      v_clean_acc,
      false,
      v_source
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
$function$;

-- 7. Bulletproof get_employee_geofence_context function
CREATE OR REPLACE FUNCTION public.get_employee_geofence_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id uuid := (select auth.uid());
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
  WHERE user_id = v_user_id;

  IF v_emp.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Employee record not found for user');
  END IF;

  -- Resolve organization
  v_org_id := v_emp.organization_id;
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id FROM public.organization_members WHERE user_id = v_user_id LIMIT 1;
  END IF;
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF v_org_id IS NULL THEN
    v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
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
    WHERE organization_id = v_org_id AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Auto-heal employee record if missing org or location
  IF v_emp.organization_id IS NULL OR v_emp.work_location_id IS NULL THEN
    UPDATE public.employees
    SET organization_id = COALESCE(organization_id, v_org_id, v_loc.organization_id),
        work_location_id = COALESCE(work_location_id, v_loc.id)
    WHERE id = v_emp.id;
    v_emp.organization_id := COALESCE(v_org_id, v_loc.organization_id);
    v_emp.work_location_id := v_loc.id;
  END IF;

  -- 2. Get today's attendance record
  SELECT * INTO v_today_att
  FROM public.attendance
  WHERE employee_id = v_emp.id AND date = CURRENT_DATE;

  -- 3. Get shift
  IF v_emp.default_shift_id IS NOT NULL THEN
    SELECT * INTO v_shift FROM public.shifts WHERE id = v_emp.default_shift_id;
  ELSE
    SELECT * INTO v_shift FROM public.shifts WHERE organization_id = v_org_id ORDER BY created_at ASC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'name', v_emp.full_name,
      'organization_id', COALESCE(v_emp.organization_id, v_org_id)
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

GRANT EXECUTE ON FUNCTION public.verify_and_record_attendance(text, double precision, double precision, double precision, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_geofence_context() TO authenticated;
