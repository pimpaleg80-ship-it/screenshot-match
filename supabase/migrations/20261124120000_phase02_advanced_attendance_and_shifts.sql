-- 20261124120000_phase02_advanced_attendance_and_shifts.sql
-- FLOWPEOPLE PHASE 02: Advanced Attendance + Shift Management
-- Additive migration for advanced attendance calculations, overnight shifts, shift rosters, swap requests, and correction approvals.

-- 1. Extend public.shifts table
ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS break_duration_minutes integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS grace_period_minutes integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS early_departure_grace_minutes integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS half_day_min_hours numeric(4,2) DEFAULT 4.0,
ADD COLUMN IF NOT EXISTS full_day_min_hours numeric(4,2) DEFAULT 8.0,
ADD COLUMN IF NOT EXISTS is_night_shift boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_rotating boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS rotation_pattern text DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS color text DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Update / Seed the 4 Core Shift Presets (Morning, General, Evening, Night)
INSERT INTO public.shifts (name, code, start_time, end_time, break_duration_minutes, grace_period_minutes, early_departure_grace_minutes, half_day_min_hours, full_day_min_hours, is_night_shift, work_days, color, organization_id)
SELECT 
  'Morning Shift', 'SH-MORN', '06:00:00'::time, '15:00:00'::time, 60, 15, 15, 4.0, 8.0, false,
  ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], '#06b6d4', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.shifts WHERE code = 'SH-MORN');

UPDATE public.shifts
SET break_duration_minutes = 60, grace_period_minutes = 15, early_departure_grace_minutes = 15, is_night_shift = false, color = '#06b6d4'
WHERE code = 'SH-MORN' AND break_duration_minutes IS NULL;

INSERT INTO public.shifts (name, code, start_time, end_time, break_duration_minutes, grace_period_minutes, early_departure_grace_minutes, half_day_min_hours, full_day_min_hours, is_night_shift, work_days, color, organization_id)
SELECT 
  'General Day Shift', 'SH-GEN', '09:00:00'::time, '18:00:00'::time, 60, 15, 15, 4.0, 8.0, false,
  ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], '#3b82f6', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.shifts WHERE code = 'SH-GEN');

UPDATE public.shifts
SET break_duration_minutes = 60, grace_period_minutes = 15, early_departure_grace_minutes = 15, is_night_shift = false, color = '#3b82f6'
WHERE code = 'SH-GEN' AND break_duration_minutes IS NULL;

INSERT INTO public.shifts (name, code, start_time, end_time, break_duration_minutes, grace_period_minutes, early_departure_grace_minutes, half_day_min_hours, full_day_min_hours, is_night_shift, work_days, color, organization_id)
SELECT 
  'Evening Shift', 'SH-EVE', '14:00:00'::time, '23:00:00'::time, 60, 15, 15, 4.0, 8.0, false,
  ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], '#8b5cf6', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.shifts WHERE code = 'SH-EVE');

INSERT INTO public.shifts (name, code, start_time, end_time, break_duration_minutes, grace_period_minutes, early_departure_grace_minutes, half_day_min_hours, full_day_min_hours, is_night_shift, work_days, color, organization_id)
SELECT 
  'Night Shift (Overnight)', 'SH-NIGHT', '22:00:00'::time, '07:00:00'::time, 60, 15, 15, 4.0, 8.0, true,
  ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], '#ec4899', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.shifts WHERE code = 'SH-NIGHT');

UPDATE public.shifts
SET break_duration_minutes = 60, grace_period_minutes = 15, early_departure_grace_minutes = 15, is_night_shift = true, color = '#ec4899'
WHERE code = 'SH-NIGHT' AND is_night_shift IS NOT TRUE;

-- 2. Extend public.attendance table
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS working_hours numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_hours numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_late boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS late_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_early_departure boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS early_departure_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_half_day boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_missing_punch boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS device_id text,
ADD COLUMN IF NOT EXISTS organization_id uuid;

CREATE INDEX IF NOT EXISTS idx_attendance_shift_id ON public.attendance(shift_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance(employee_id, date);

-- 3. Shift Assignments Table (individual or department-wide)
CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  organization_id uuid,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_shift_target CHECK (employee_id IS NOT NULL OR department_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee ON public.shift_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_department ON public.shift_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_dates ON public.shift_assignments(start_date, end_date);

-- 4. Shift Swap / Change Requests Table
CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  target_employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  requester_shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  requested_shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  swap_date date NOT NULL,
  reason text NOT NULL,
  target_accepted boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_swap_requester ON public.shift_swap_requests(requester_employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_target ON public.shift_swap_requests(target_employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_status ON public.shift_swap_requests(status);

-- 5. Attendance Correction Requests Table
CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid REFERENCES public.attendance(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid,
  date date NOT NULL,
  requested_check_in time,
  requested_check_out time,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_employee ON public.attendance_corrections(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_status ON public.attendance_corrections(status);

-- 6. Enable RLS
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;

-- 7. Shift Assignments Policies
DROP POLICY IF EXISTS "shift_assignments_view" ON public.shift_assignments;
CREATE POLICY "shift_assignments_view" ON public.shift_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shift_assignments_admin_all" ON public.shift_assignments;
CREATE POLICY "shift_assignments_admin_all" ON public.shift_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()));

-- 8. Shift Swap Requests Policies
DROP POLICY IF EXISTS "shift_swap_admin_all" ON public.shift_swap_requests;
CREATE POLICY "shift_swap_admin_all" ON public.shift_swap_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "shift_swap_employee_select" ON public.shift_swap_requests;
CREATE POLICY "shift_swap_employee_select" ON public.shift_swap_requests
  FOR SELECT TO authenticated
  USING (
    requester_employee_id = public.get_current_employee_id() OR
    target_employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "shift_swap_employee_insert" ON public.shift_swap_requests;
CREATE POLICY "shift_swap_employee_insert" ON public.shift_swap_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "shift_swap_employee_update" ON public.shift_swap_requests;
CREATE POLICY "shift_swap_employee_update" ON public.shift_swap_requests
  FOR UPDATE TO authenticated
  USING (
    requester_employee_id = public.get_current_employee_id() OR
    target_employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR
    public.is_superadmin(auth.uid())
  )
  WITH CHECK (
    requester_employee_id = public.get_current_employee_id() OR
    target_employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR
    public.is_superadmin(auth.uid())
  );

-- 9. Attendance Corrections Policies
DROP POLICY IF EXISTS "attendance_corrections_admin_all" ON public.attendance_corrections;
CREATE POLICY "attendance_corrections_admin_all" ON public.attendance_corrections
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "attendance_corrections_employee_select" ON public.attendance_corrections;
CREATE POLICY "attendance_corrections_employee_select" ON public.attendance_corrections
  FOR SELECT TO authenticated
  USING (
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "attendance_corrections_employee_insert" ON public.attendance_corrections;
CREATE POLICY "attendance_corrections_employee_insert" ON public.attendance_corrections
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.get_current_employee_id() OR
    public.has_role(auth.uid(), 'admin') OR
    public.is_superadmin(auth.uid())
  );

-- 10. Helper function: calculate attendance metrics & apply rules
CREATE OR REPLACE FUNCTION public.calculate_attendance_metrics(
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_shift_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_shift record;
  v_check_in_time time;
  v_check_out_time time;
  v_scheduled_start time;
  v_scheduled_end time;
  v_grace_mins int := 15;
  v_early_grace_mins int := 15;
  v_break_mins int := 60;
  v_half_day_hrs numeric := 4.0;
  v_full_day_hrs numeric := 8.0;
  v_is_night boolean := false;
  
  v_worked_minutes int := 0;
  v_working_hours numeric(5,2) := 0;
  v_overtime_hours numeric(5,2) := 0;
  v_is_late boolean := false;
  v_late_mins int := 0;
  v_is_early boolean := false;
  v_early_mins int := 0;
  v_status text := 'present';
  v_scheduled_work_mins int := 480;
BEGIN
  IF p_shift_id IS NOT NULL THEN
    SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
    IF v_shift.id IS NOT NULL THEN
      v_scheduled_start := v_shift.start_time;
      v_scheduled_end := v_shift.end_time;
      v_grace_mins := COALESCE(v_shift.grace_period_minutes, 15);
      v_early_grace_mins := COALESCE(v_shift.early_departure_grace_minutes, 15);
      v_break_mins := COALESCE(v_shift.break_duration_minutes, 60);
      v_half_day_hrs := COALESCE(v_shift.half_day_min_hours, 4.0);
      v_full_day_hrs := COALESCE(v_shift.full_day_min_hours, 8.0);
      v_is_night := COALESCE(v_shift.is_night_shift, false);
      
      -- Calculate scheduled duration
      IF v_scheduled_end < v_scheduled_start OR v_is_night THEN
        v_scheduled_work_mins := (1440 - (EXTRACT(HOUR FROM v_scheduled_start)*60 + EXTRACT(MINUTE FROM v_scheduled_start))) 
                                 + (EXTRACT(HOUR FROM v_scheduled_end)*60 + EXTRACT(MINUTE FROM v_scheduled_end)) - v_break_mins;
      ELSE
        v_scheduled_work_mins := ((EXTRACT(HOUR FROM v_scheduled_end)*60 + EXTRACT(MINUTE FROM v_scheduled_end)) 
                                 - (EXTRACT(HOUR FROM v_scheduled_start)*60 + EXTRACT(MINUTE FROM v_scheduled_start))) - v_break_mins;
      END IF;
    END IF;
  END IF;

  -- Late check-in evaluation
  IF p_check_in IS NOT NULL AND v_scheduled_start IS NOT NULL THEN
    v_check_in_time := p_check_in::time;
    IF v_check_in_time > (v_scheduled_start + (v_grace_mins || ' minutes')::interval) THEN
      v_is_late := true;
      v_late_mins := EXTRACT(EPOCH FROM (v_check_in_time - v_scheduled_start)) / 60;
      IF v_late_mins < 0 THEN v_late_mins := 0; END IF;
    END IF;
  END IF;

  -- Early departure & working hours evaluation
  IF p_check_in IS NOT NULL AND p_check_out IS NOT NULL THEN
    v_worked_minutes := EXTRACT(EPOCH FROM (p_check_out - p_check_in)) / 60;
    IF v_worked_minutes > v_break_mins THEN
      v_working_hours := ROUND(((v_worked_minutes - v_break_mins) / 60.0)::numeric, 2);
    ELSE
      v_working_hours := ROUND((v_worked_minutes / 60.0)::numeric, 2);
    END IF;

    -- Overtime calculation
    IF v_worked_minutes > (v_scheduled_work_mins + v_break_mins) THEN
      v_overtime_hours := ROUND(((v_worked_minutes - (v_scheduled_work_mins + v_break_mins)) / 60.0)::numeric, 2);
    END IF;

    -- Early departure
    IF v_scheduled_end IS NOT NULL THEN
      v_check_out_time := p_check_out::time;
      IF v_check_out_time < (v_scheduled_end - (v_early_grace_mins || ' minutes')::interval) THEN
        v_is_early := true;
        v_early_mins := EXTRACT(EPOCH FROM (v_scheduled_end - v_check_out_time)) / 60;
        IF v_early_mins < 0 THEN v_early_mins := 0; END IF;
      END IF;
    END IF;

    -- Status determination
    IF v_working_hours < v_half_day_hrs THEN
      v_status := 'half_day';
    ELSIF v_is_late THEN
      v_status := 'late';
    ELSE
      v_status := 'present';
    END IF;
  ELSIF p_check_in IS NOT NULL THEN
    IF v_is_late THEN
      v_status := 'late';
    ELSE
      v_status := 'present';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'working_hours', v_working_hours,
    'overtime_hours', v_overtime_hours,
    'is_late', v_is_late,
    'late_minutes', v_late_mins,
    'is_early_departure', v_is_early,
    'early_departure_minutes', v_early_mins,
    'status', v_status
  );
END;
$$;

-- 11. RPC: approve_attendance_correction
CREATE OR REPLACE FUNCTION public.approve_attendance_correction(
  p_correction_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corr record;
  v_emp record;
  v_shift_id uuid;
  v_in_ts timestamptz;
  v_out_ts timestamptz;
  v_metrics jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Only administrators or managers can approve correction requests.';
  END IF;

  SELECT * INTO v_corr FROM public.attendance_corrections WHERE id = p_correction_id;
  IF v_corr.id IS NULL THEN
    RAISE EXCEPTION 'Correction request not found.';
  END IF;

  IF v_corr.status <> 'pending' THEN
    RAISE EXCEPTION 'This correction request is already %', v_corr.status;
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = v_corr.employee_id;
  v_shift_id := v_emp.shift_id;

  IF v_corr.requested_check_in IS NOT NULL THEN
    v_in_ts := (v_corr.date::text || ' ' || v_corr.requested_check_in::text)::timestamptz;
  END IF;

  IF v_corr.requested_check_out IS NOT NULL THEN
    v_out_ts := (v_corr.date::text || ' ' || v_corr.requested_check_out::text)::timestamptz;
  END IF;

  v_metrics := public.calculate_attendance_metrics(v_in_ts, v_out_ts, v_shift_id);

  -- Upsert attendance record
  IF v_corr.attendance_id IS NOT NULL THEN
    UPDATE public.attendance
    SET check_in = COALESCE(v_in_ts::text, check_in),
        check_out = COALESCE(v_out_ts::text, check_out),
        shift_id = COALESCE(v_shift_id, shift_id),
        working_hours = (v_metrics->>'working_hours')::numeric,
        overtime_hours = (v_metrics->>'overtime_hours')::numeric,
        is_late = (v_metrics->>'is_late')::boolean,
        late_minutes = (v_metrics->>'late_minutes')::integer,
        is_early_departure = (v_metrics->>'is_early_departure')::boolean,
        early_departure_minutes = (v_metrics->>'early_departure_minutes')::integer,
        status = (v_metrics->>'status')::attendance_status,
        note = 'Corrected by HR approval (' || COALESCE(p_admin_notes, 'Approved') || ')'
    WHERE id = v_corr.attendance_id;
  ELSE
    INSERT INTO public.attendance (
      employee_id,
      date,
      check_in,
      check_out,
      shift_id,
      method,
      status,
      working_hours,
      overtime_hours,
      is_late,
      late_minutes,
      is_early_departure,
      early_departure_minutes,
      note
    ) VALUES (
      v_corr.employee_id,
      v_corr.date::text,
      v_in_ts::text,
      v_out_ts::text,
      v_shift_id,
      'manual',
      (v_metrics->>'status')::attendance_status,
      (v_metrics->>'working_hours')::numeric,
      (v_metrics->>'overtime_hours')::numeric,
      (v_metrics->>'is_late')::boolean,
      (v_metrics->>'late_minutes')::integer,
      (v_metrics->>'is_early_departure')::boolean,
      (v_metrics->>'early_departure_minutes')::integer,
      'Added by HR correction approval (' || COALESCE(p_admin_notes, 'Approved') || ')'
    );
  END IF;

  -- Mark correction approved
  UPDATE public.attendance_corrections
  SET status = 'approved',
      decided_by = auth.uid(),
      admin_notes = p_admin_notes,
      decided_at = now()
  WHERE id = p_correction_id;

  RETURN jsonb_build_object('success', true, 'correction_id', p_correction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_attendance_correction(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_attendance_metrics(timestamptz, timestamptz, uuid) TO authenticated;
