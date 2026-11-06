-- 20261106200000_fix_work_locations_save_and_exact_geofence.sql
-- Fix work_locations RLS policies, add save_office_location RPC, and eliminate accuracy drift errors

-- 1. Update RLS policies on work_locations using is_admin_or_superadmin()
DROP POLICY IF EXISTS "work_locations_admin_manage" ON public.work_locations;
CREATE POLICY "work_locations_admin_manage" ON public.work_locations
FOR ALL TO authenticated
USING (
  public.is_admin_or_superadmin()
  OR organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid()) AND om.role IN ('super_admin', 'org_admin', 'hr_manager')
  )
)
WITH CHECK (
  public.is_admin_or_superadmin()
  OR organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid()) AND om.role IN ('super_admin', 'org_admin', 'hr_manager')
  )
);

DROP POLICY IF EXISTS "work_locations_read" ON public.work_locations;
CREATE POLICY "work_locations_read" ON public.work_locations
FOR SELECT TO authenticated
USING (
  public.is_admin_or_superadmin()
  OR organization_id IN (
    SELECT e.organization_id FROM public.employees e WHERE e.user_id = (SELECT auth.uid())
  )
  OR organization_id IN (
    SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = (SELECT auth.uid())
  )
);

-- 2. Dedicated Secure RPC for saving and updating office locations
CREATE OR REPLACE FUNCTION public.save_office_location(
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT 'Office',
  p_address text DEFAULT NULL,
  p_lat double precision DEFAULT 18.5204,
  p_lon double precision DEFAULT 73.8567,
  p_radius integer DEFAULT 150,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id uuid := (select auth.uid());
  v_org_id uuid;
  v_loc record;
BEGIN
  -- Strict authentication check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Admin check
  IF NOT public.is_admin_or_superadmin() THEN
    RAISE EXCEPTION 'Unauthorized: Only Organization Admins and Superadmins can manage office locations.';
  END IF;

  -- Resolve organization_id
  SELECT organization_id INTO v_org_id
  FROM public.employees
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = v_user_id
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  IF p_id IS NOT NULL THEN
    -- Update existing location
    UPDATE public.work_locations
    SET name = trim(p_name),
        address = NULLIF(trim(p_address), ''),
        latitude = p_lat,
        longitude = p_lon,
        radius_meters = COALESCE(p_radius, 150),
        is_active = COALESCE(p_is_active, true),
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_loc;

    IF v_loc.id IS NULL THEN
      -- If record with p_id not found, insert
      INSERT INTO public.work_locations (
        id, organization_id, name, address, latitude, longitude, radius_meters, is_active, created_at, updated_at
      ) VALUES (
        p_id, v_org_id, trim(p_name), NULLIF(trim(p_address), ''), p_lat, p_lon, COALESCE(p_radius, 150), COALESCE(p_is_active, true), now(), now()
      )
      RETURNING * INTO v_loc;
    END IF;
  ELSE
    -- Insert new location
    INSERT INTO public.work_locations (
      organization_id, name, address, latitude, longitude, radius_meters, is_active, created_at, updated_at
    ) VALUES (
      v_org_id, trim(p_name), NULLIF(trim(p_address), ''), p_lat, p_lon, COALESCE(p_radius, 150), COALESCE(p_is_active, true), now(), now()
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
    'is_active', v_loc.is_active
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.save_office_location TO authenticated;

-- 3. Eliminate accuracy drift errors in verify_and_record_attendance
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

  -- Calculate distance to office geofence center using Haversine formula
  v_dist := public.calculate_haversine_distance(p_lat, p_lon, v_loc.latitude, v_loc.longitude);
  v_max_radius := COALESCE(v_loc.radius_meters, 150);

  -- GEOFENCE GATING ENFORCEMENT
  IF v_dist > v_max_radius THEN
    -- Log out-of-bounds event
    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock, location_source
    ) VALUES (
      v_emp.organization_id, v_emp.id, v_loc.id, 'EXIT', p_lat, p_lon, v_clean_acc, false, v_source
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
        v_emp.organization_id, v_emp.id, CURRENT_DATE, now(), v_status::public.attendance_status, 'manual_geofence',
        v_loc.id, p_lat, p_lon, v_reg_device_id, v_source
      )
      RETURNING id INTO v_new_att_id;
    END IF;

    -- Log verified geofence entry
    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock, location_source
    ) VALUES (
      v_emp.organization_id, v_emp.id, v_loc.id, 'ENTER', p_lat, p_lon, v_clean_acc, false, v_source
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

    -- Log verified geofence exit event
    INSERT INTO public.geofence_events (
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock, location_source
    ) VALUES (
      v_emp.organization_id, v_emp.id, v_loc.id, 'EXIT', p_lat, p_lon, v_clean_acc, false, v_source
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
