-- ============================================================================
-- FlowPeople — Geofencing Attendance Support
-- Enables employee-side GPS geofence clock-in/out and distance validation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_geofence_punch(
  p_latitude double precision,
  p_longitude double precision,
  p_work_location_id uuid DEFAULT NULL,
  p_accuracy double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_employee_id uuid;
  v_org_id uuid;
  v_loc record;
  v_distance double precision;
  v_min_distance double precision := 999999999;
  v_closest_loc record;
  v_today date := current_date;
  v_now timestamptz := now();
  v_attendance record;
  v_total_hours numeric(5,2);
  v_is_inside boolean := false;
  R constant double precision := 6371000; -- Earth radius in meters
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- 1. Get employee for user
  SELECT id, organization_id INTO v_employee_id, v_org_id
  FROM public.employees
  WHERE auth_user_id = v_user_id OR id = v_user_id
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    v_employee_id := public.current_employee_id();
    IF v_employee_id IS NOT NULL THEN
      SELECT organization_id INTO v_org_id FROM public.employees WHERE id = v_employee_id;
    END IF;
  END IF;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active employee profile linked to your account');
  END IF;

  -- 2. Find closest active work location and calculate distance
  FOR v_loc IN
    SELECT id, name, latitude, longitude, radius_meters
    FROM public.work_locations
    WHERE is_active = true AND (v_org_id IS NULL OR organization_id = v_org_id)
  LOOP
    IF v_loc.latitude IS NOT NULL AND v_loc.longitude IS NOT NULL THEN
      dlat := radians(v_loc.latitude - p_latitude);
      dlon := radians(v_loc.longitude - p_longitude);
      a := sin(dlat/2)^2 + cos(radians(p_latitude)) * cos(radians(v_loc.latitude)) * sin(dlon/2)^2;
      c := 2 * atan2(sqrt(a), sqrt(1-a));
      v_distance := round((R * c)::numeric, 1);

      IF v_distance < v_min_distance THEN
        v_min_distance := v_distance;
        v_closest_loc := v_loc;
      END IF;
    END IF;
  END LOOP;

  IF v_closest_loc.id IS NULL THEN
    v_is_inside := true;
    v_min_distance := 0;
  ELSE
    v_is_inside := (v_min_distance <= COALESCE(v_closest_loc.radius_meters, 150));
  END IF;

  -- Check existing attendance record today
  SELECT * INTO v_attendance
  FROM public.attendance
  WHERE employee_id = v_employee_id AND date = v_today;

  IF v_attendance.id IS NULL THEN
    -- PUNCH IN
    INSERT INTO public.attendance (
      employee_id,
      organization_id,
      date,
      check_in,
      status,
      method,
      work_location_id,
      check_in_lat,
      check_in_lon,
      location_source,
      note
    ) VALUES (
      v_employee_id,
      v_org_id,
      v_today,
      v_now,
      'present',
      'geofence',
      v_closest_loc.id,
      p_latitude,
      p_longitude,
      'geofence_gps',
      CASE WHEN v_is_inside THEN 'Verified inside geofence (' || COALESCE(v_closest_loc.name, 'Office') || ')'
           ELSE 'Punched outside geofence (' || v_min_distance || 'm away)' END
    ) RETURNING * INTO v_attendance;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'check_in',
      'time', to_char(v_now, 'HH24:MI:SS'),
      'date', v_today,
      'is_inside', v_is_inside,
      'distance_meters', v_min_distance,
      'location_name', COALESCE(v_closest_loc.name, 'Main Office'),
      'allowed_radius', COALESCE(v_closest_loc.radius_meters, 100)
    );
  ELSE
    -- PUNCH OUT
    v_total_hours := round((EXTRACT(EPOCH FROM (v_now - v_attendance.check_in)) / 3600.0)::numeric, 2);

    UPDATE public.attendance
    SET
      check_out = v_now,
      check_out_lat = p_latitude,
      check_out_lon = p_longitude,
      total_hours = v_total_hours,
      working_hours = v_total_hours,
      updated_at = v_now
    WHERE id = v_attendance.id
    RETURNING * INTO v_attendance;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'check_out',
      'time', to_char(v_now, 'HH24:MI:SS'),
      'date', v_today,
      'is_inside', v_is_inside,
      'distance_meters', v_min_distance,
      'total_hours', v_total_hours,
      'location_name', COALESCE(v_closest_loc.name, 'Main Office'),
      'allowed_radius', COALESCE(v_closest_loc.radius_meters, 100)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_geofence_punch TO authenticated;

-- Ensure RLS allows employee insert & update
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance' AND policyname = 'attendance: employee insert own') THEN
    CREATE POLICY "attendance: employee insert own"
      ON public.attendance FOR INSERT
      TO authenticated
      WITH CHECK (employee_id = current_employee_id() OR employee_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance' AND policyname = 'attendance: employee update own') THEN
    CREATE POLICY "attendance: employee update own"
      ON public.attendance FOR UPDATE
      TO authenticated
      USING (employee_id = current_employee_id() OR employee_id = auth.uid())
      WITH CHECK (employee_id = current_employee_id() OR employee_id = auth.uid());
  END IF;
END $$;
