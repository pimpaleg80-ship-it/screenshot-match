-- 20261125000000_geofence_only_attendance_sync.sql
-- Drop duplicate overloaded verify_and_record_attendance signature, sync working_hours + total_hours,
-- and guarantee automatic Main Office fallback when HR updates or activates work locations.

DROP FUNCTION IF EXISTS public.verify_and_record_attendance(text, double precision, double precision, double precision, text);

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
  v_used_fallback boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_action NOT IN ('check_in', 'check_out') THEN
    RAISE EXCEPTION 'Invalid attendance action: %. Must be check_in or check_out.', p_action;
  END IF;

  SELECT id, organization_id, full_name, work_location_id, default_shift_id
  INTO v_emp
  FROM public.employees
  WHERE user_id = v_user_id;

  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'No employee profile linked to user account %.', v_user_id;
  END IF;

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
    IF v_loc.id IS NOT NULL THEN
      v_used_fallback := true;
    END IF;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE organization_id = v_org_id AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_loc.id IS NOT NULL THEN
      v_used_fallback := true;
    END IF;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_loc.id IS NOT NULL THEN
      v_used_fallback := true;
    END IF;
  END IF;

  IF v_loc.id IS NULL THEN
    RAISE EXCEPTION 'No active Main Office geofence configured. Please ask HR Admin to set Main Office coordinates in Settings.';
  END IF;

  IF v_emp.organization_id IS NULL OR v_emp.work_location_id IS NULL OR v_used_fallback THEN
    UPDATE public.employees
    SET organization_id = COALESCE(organization_id, v_org_id, v_loc.organization_id),
        work_location_id = v_loc.id
    WHERE id = v_emp.id;
    v_emp.organization_id := COALESCE(v_org_id, v_loc.organization_id);
    v_emp.work_location_id := v_loc.id;
  END IF;

  v_dist := public.calculate_haversine_distance(p_lat, p_lon, v_loc.latitude, v_loc.longitude);
  v_max_radius := COALESCE(v_loc.radius_meters, 150);

  IF v_dist > v_max_radius THEN
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
      RAISE EXCEPTION 'You are %m away from % (Allowed radius: %m). Check-in is only enabled inside the selected office geofence.',
        round(v_dist::numeric, 1), v_loc.name, v_max_radius;
    ELSE
      RAISE EXCEPTION 'You are %m away from % (Allowed radius: %m). Check-out is only enabled inside the selected office geofence.',
        round(v_dist::numeric, 1), v_loc.name, v_max_radius;
    END IF;
  END IF;

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

  IF p_action = 'check_in' THEN
    SELECT * INTO v_today_att
    FROM public.attendance
    WHERE employee_id = v_emp.id AND date = CURRENT_DATE;

    IF v_today_att.id IS NOT NULL AND v_today_att.check_in IS NOT NULL THEN
      RAISE EXCEPTION 'You are already checked in for today at %.', to_char(v_today_att.check_in, 'HH24:MI');
    END IF;

    IF v_emp.default_shift_id IS NOT NULL THEN
      SELECT * INTO v_shift FROM public.shifts WHERE id = v_emp.default_shift_id;
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
        COALESCE(v_emp.organization_id, v_org_id, v_loc.organization_id),
        v_emp.id,
        CURRENT_DATE,
        now(),
        v_status::public.attendance_status,
        'geofence',
        v_loc.id,
        p_lat,
        p_lon,
        v_reg_device_id,
        v_source
      )
      RETURNING id INTO v_new_att_id;
    END IF;

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
        working_hours = v_hours,
        location_source = v_source,
        updated_at = now()
    WHERE id = v_today_att.id;

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
  v_used_fallback boolean := false;
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
    IF v_loc.id IS NOT NULL THEN
      v_used_fallback := true;
    END IF;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE organization_id = v_org_id AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_loc.id IS NOT NULL THEN
      v_used_fallback := true;
    END IF;
  END IF;

  IF v_loc.id IS NULL THEN
    SELECT * INTO v_loc
    FROM public.work_locations
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_loc.id IS NOT NULL THEN
      v_used_fallback := true;
    END IF;
  END IF;

  IF v_loc.id IS NOT NULL AND (v_emp.organization_id IS NULL OR v_emp.work_location_id IS NULL OR v_used_fallback) THEN
    UPDATE public.employees
    SET organization_id = COALESCE(organization_id, v_org_id, v_loc.organization_id),
        work_location_id = v_loc.id
    WHERE id = v_emp.id;
    v_emp.organization_id := COALESCE(v_org_id, v_loc.organization_id);
    v_emp.work_location_id := v_loc.id;
  END IF;

  SELECT * INTO v_today_att
  FROM public.attendance
  WHERE employee_id = v_emp.id AND date = CURRENT_DATE;

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

GRANT EXECUTE ON FUNCTION public.verify_and_record_attendance(text, double precision, double precision, double precision, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_geofence_context() TO authenticated;
