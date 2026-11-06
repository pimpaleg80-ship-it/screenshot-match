-- 20261106190000_optimize_performance_indexes_and_location_tracking.sql
-- Supabase Performance Optimization & Location Source Tracking Migration

-- 1. Location Source Column Enhancements
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS location_source text DEFAULT 'browser_gps';

ALTER TABLE public.geofence_events 
  ADD COLUMN IF NOT EXISTS location_source text DEFAULT 'browser_gps';

-- 2. Foreign Key & Query Performance Indexes (Supabase Best Practices)
-- Attendance & Geofencing
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance (employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_work_loc ON public.attendance (work_location_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org ON public.attendance (organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_device ON public.attendance (device_id);

CREATE INDEX IF NOT EXISTS idx_geofence_events_emp ON public.geofence_events (employee_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_loc ON public.geofence_events (location_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_org ON public.geofence_events (organization_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_recorded_at ON public.geofence_events (recorded_at DESC);

-- Leave Management
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON public.leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_type ON public.leave_requests (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_org ON public.leave_requests (organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_manager ON public.leave_requests (manager_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_admin ON public.leave_requests (admin_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests (from_date, to_date);

CREATE INDEX IF NOT EXISTS idx_leave_balances_emp ON public.leave_balances (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_type ON public.leave_balances (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_org ON public.leave_balances (organization_id);

CREATE INDEX IF NOT EXISTS idx_leave_types_org ON public.leave_types (organization_id);

-- Employees & Assignments
CREATE INDEX IF NOT EXISTS idx_employees_org ON public.employees (organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON public.employees (user_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON public.employees (department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON public.employees (manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_work_loc ON public.employees (work_location_id);
CREATE INDEX IF NOT EXISTS idx_employees_default_shift ON public.employees (default_shift_id);

CREATE INDEX IF NOT EXISTS idx_ela_emp ON public.employee_location_assignments (employee_id);
CREATE INDEX IF NOT EXISTS idx_ela_loc ON public.employee_location_assignments (location_id);
CREATE INDEX IF NOT EXISTS idx_ela_org ON public.employee_location_assignments (organization_id);

CREATE INDEX IF NOT EXISTS idx_esa_emp ON public.employee_shift_assignments (employee_id);
CREATE INDEX IF NOT EXISTS idx_esa_shift ON public.employee_shift_assignments (shift_id);
CREATE INDEX IF NOT EXISTS idx_esa_org ON public.employee_shift_assignments (organization_id);

-- Organizations & Settings
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_work_locations_org ON public.work_locations (organization_id);
CREATE INDEX IF NOT EXISTS idx_shifts_org ON public.shifts (organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_org ON public.departments (organization_id);
CREATE INDEX IF NOT EXISTS idx_announcements_org ON public.announcements (organization_id);
CREATE INDEX IF NOT EXISTS idx_holidays_org ON public.holidays (organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_user ON public.audit_logs (organization_id, user_id);

-- 3. Update verify_and_record_attendance to support p_location_source
CREATE OR REPLACE FUNCTION public.verify_and_record_attendance(
  p_action text,
  p_lat double precision,
  p_lon double precision,
  p_accuracy double precision DEFAULT 10.0,
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
    RAISE EXCEPTION 'GPS signal accuracy is too low (±%m > 150m tolerance). Please step into an open area, enable High Accuracy Location, or connect to office Wi-Fi.', round(p_accuracy::numeric, 1);
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
      organization_id, employee_id, location_id, event_type, latitude, longitude, accuracy_meters, is_mock, location_source
    ) VALUES (
      v_emp.organization_id, v_emp.id, v_loc.id, 'EXIT', p_lat, p_lon, p_accuracy, false, v_source
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
      v_emp.organization_id, v_emp.id, v_loc.id, 'ENTER', p_lat, p_lon, p_accuracy, false, v_source
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
      v_emp.organization_id, v_emp.id, v_loc.id, 'EXIT', p_lat, p_lon, p_accuracy, false, v_source
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
