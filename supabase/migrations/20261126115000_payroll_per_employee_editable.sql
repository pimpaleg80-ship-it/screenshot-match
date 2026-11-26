-- ==============================================================================
-- FlowPeople — Editable Per-Employee Payroll & Multi-Tenant Hardening
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_payslips_run_emp
  ON public.payslips (payroll_run_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_salary_structures_org_emp_active
  ON public.employee_salary_structures (organization_id, employee_id, is_active);

-- 1. Tighten Payroll RLS policies with strict organization_id tenant isolation
DROP POLICY IF EXISTS "payroll_runs_admin_all" ON public.payroll_runs;
CREATE POLICY "payroll_runs_admin_all"
  ON public.payroll_runs FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "payroll_runs_manager_select" ON public.payroll_runs;
CREATE POLICY "payroll_runs_manager_select"
  ON public.payroll_runs FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
    AND public.is_org_member(organization_id)
  );

DROP POLICY IF EXISTS "salary_structures_admin_all" ON public.employee_salary_structures;
CREATE POLICY "salary_structures_admin_all"
  ON public.employee_salary_structures FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "payslips_admin_all" ON public.payslips;
CREATE POLICY "payslips_admin_all"
  ON public.payslips FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "payroll_settings_admin_all" ON public.payroll_settings;
CREATE POLICY "payroll_settings_admin_all"
  ON public.payroll_settings FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "payroll_settings_read_auth" ON public.payroll_settings;
CREATE POLICY "payroll_settings_read_auth"
  ON public.payroll_settings FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

-- 2. Harden calculate_monthly_payroll_run() and handle NULL employee.status safely
CREATE OR REPLACE FUNCTION public.calculate_monthly_payroll_run(
  _organization_id uuid,
  _year integer,
  _month integer,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run_id uuid;
  v_settings public.payroll_settings%ROWTYPE;
  v_emp RECORD;
  v_struct RECORD;
  v_working_days integer;
  v_present_days numeric(5,2);
  v_unpaid_leave_days numeric(5,2);
  v_lop_days numeric(5,2);
  v_overtime_hours numeric(6,2);
  v_basic numeric(12,2);
  v_hra numeric(12,2);
  v_special numeric(12,2);
  v_conveyance numeric(12,2);
  v_medical numeric(12,2);
  v_other_allowances numeric(12,2);
  v_overtime_pay numeric(12,2);
  v_gross numeric(12,2);
  v_pf_emp numeric(12,2);
  v_pf_empr numeric(12,2);
  v_esi_emp numeric(12,2);
  v_esi_empr numeric(12,2);
  v_pt numeric(12,2);
  v_tds numeric(12,2);
  v_lop_deduction numeric(12,2);
  v_total_deductions numeric(12,2);
  v_net numeric(12,2);
  v_start_date date;
  v_end_date date;
  v_month_name text;

  v_tot_employees integer := 0;
  v_tot_gross numeric(14,2) := 0;
  v_tot_deductions numeric(14,2) := 0;
  v_tot_net numeric(14,2) := 0;
  v_tot_pf_emp numeric(14,2) := 0;
  v_tot_pf_empr numeric(14,2) := 0;
  v_tot_esi_emp numeric(14,2) := 0;
  v_tot_esi_empr numeric(14,2) := 0;
  v_tot_pt numeric(14,2) := 0;
  v_tot_tds numeric(14,2) := 0;
  v_tot_lop numeric(14,2) := 0;
  v_caller_uid uuid := (SELECT auth.uid());
  v_jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
BEGIN
  IF v_jwt_role = 'anon' OR (v_jwt_role = 'authenticated' AND v_caller_uid IS NULL) THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_uid IS NOT NULL AND NOT public.is_org_admin(_organization_id) THEN
    RAISE EXCEPTION 'Forbidden: only HR/Admin users can process payroll.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_settings FROM public.payroll_settings
  WHERE organization_id = _organization_id;

  IF NOT FOUND THEN
    INSERT INTO public.payroll_settings (organization_id)
    VALUES (_organization_id)
    RETURNING * INTO v_settings;
  END IF;

  v_start_date := make_date(_year, _month, 1);
  v_end_date := (v_start_date + interval '1 month - 1 day')::date;
  v_month_name := to_char(v_start_date, 'FMMonth YYYY');

  IF v_settings.working_days_method = 'fixed_30' THEN
    v_working_days := 30;
  ELSIF v_settings.working_days_method = 'fixed_26' THEN
    v_working_days := 26;
  ELSE
    v_working_days := EXTRACT(DAY FROM v_end_date)::integer;
  END IF;

  INSERT INTO public.payroll_runs (
    organization_id, month, year, title, status, processed_by, processed_at
  )
  VALUES (
    _organization_id, _month, _year, 'Payroll - ' || v_month_name, 'draft', _user_id, now()
  )
  ON CONFLICT (organization_id, year, month)
  DO UPDATE SET
    title = 'Payroll - ' || v_month_name,
    status = CASE WHEN payroll_runs.status = 'locked' THEN 'locked' ELSE 'draft' END,
    processed_by = _user_id,
    processed_at = now(),
    updated_at = now()
  RETURNING id INTO v_run_id;

  IF EXISTS (SELECT 1 FROM public.payroll_runs WHERE id = v_run_id AND status = 'locked') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll run is locked and cannot be recalculated.');
  END IF;

  DELETE FROM public.payslips WHERE payroll_run_id = v_run_id;

  FOR v_emp IN
    SELECT e.id, e.full_name, e.employee_code, e.bank_name, e.bank_account_number, e.pan_number
    FROM public.employees e
    WHERE e.organization_id = _organization_id
      AND COALESCE(e.status, 'active') NOT IN ('relieved', 'terminated')
  LOOP
    SELECT * INTO v_struct
    FROM public.employee_salary_structures
    WHERE employee_id = v_emp.id AND is_active = true
    ORDER BY effective_from DESC LIMIT 1;

    IF FOUND THEN
      v_basic := v_struct.basic_salary;
      v_hra := v_struct.hra;
      v_special := v_struct.special_allowance;
      v_conveyance := v_struct.conveyance_allowance;
      v_medical := v_struct.medical_allowance;
      v_other_allowances := v_struct.other_allowances;
    ELSE
      v_basic := 25000.00;
      v_hra := 12500.00;
      v_special := 9500.00;
      v_conveyance := 1500.00;
      v_medical := 1500.00;
      v_other_allowances := 0;
    END IF;

    SELECT
      COALESCE(COUNT(*), 0),
      COALESCE(SUM(overtime_hours), 0)
    INTO v_present_days, v_overtime_hours
    FROM public.attendance
    WHERE employee_id = v_emp.id
      AND date >= v_start_date AND date <= v_end_date
      AND status IN ('present', 'late', 'half_day');

    SELECT COALESCE(SUM(days), 0)
    INTO v_unpaid_leave_days
    FROM public.leave_requests
    WHERE employee_id = v_emp.id
      AND status = 'approved'
      AND from_date <= v_end_date AND to_date >= v_start_date;

    IF v_present_days = 0 AND v_unpaid_leave_days = 0 THEN
      v_present_days := v_working_days;
      v_lop_days := 0;
    ELSE
      v_lop_days := GREATEST(0, v_working_days - (v_present_days + v_unpaid_leave_days));
    END IF;

    v_overtime_pay := ROUND((v_overtime_hours * ((v_basic / v_working_days) / 8.0) * v_settings.overtime_multiplier), 2);
    v_gross := v_basic + v_hra + v_special + v_conveyance + v_medical + v_other_allowances + v_overtime_pay;
    v_lop_deduction := ROUND(((v_gross / v_working_days) * v_lop_days), 2);

    IF v_settings.pf_enabled AND (v_struct.pf_applicable IS NULL OR v_struct.pf_applicable = true) THEN
      IF v_settings.pf_ceiling_enabled AND (v_struct.pf_cap_at_ceiling IS NULL OR v_struct.pf_cap_at_ceiling = true) THEN
        v_pf_emp := ROUND((LEAST(v_basic, v_settings.pf_wage_ceiling) * (v_settings.pf_employee_rate / 100.0)), 2);
        v_pf_empr := ROUND((LEAST(v_basic, v_settings.pf_wage_ceiling) * (v_settings.pf_employer_rate / 100.0)), 2);
      ELSE
        v_pf_emp := ROUND((v_basic * (v_settings.pf_employee_rate / 100.0)), 2);
        v_pf_empr := ROUND((v_basic * (v_settings.pf_employer_rate / 100.0)), 2);
      END IF;
    ELSE
      v_pf_emp := 0;
      v_pf_empr := 0;
    END IF;

    IF v_settings.esi_enabled AND v_gross <= v_settings.esi_gross_ceiling AND (v_struct.esi_applicable IS NULL OR v_struct.esi_applicable = true) THEN
      v_esi_emp := ROUND((v_gross * (v_settings.esi_employee_rate / 100.0)), 2);
      v_esi_empr := ROUND((v_gross * (v_settings.esi_employer_rate / 100.0)), 2);
    ELSE
      v_esi_emp := 0;
      v_esi_empr := 0;
    END IF;

    IF v_settings.pt_enabled AND (v_struct.pt_applicable IS NULL OR v_struct.pt_applicable = true) THEN
      IF v_gross >= 15000 THEN
        v_pt := 200.00;
      ELSE
        v_pt := 0.00;
      END IF;
    ELSE
      v_pt := 0;
    END IF;

    v_tds := COALESCE(v_struct.tds_monthly, 0.00);
    v_total_deductions := v_pf_emp + v_esi_emp + v_pt + v_tds + v_lop_deduction;
    v_net := GREATEST(0, v_gross - v_total_deductions);

    INSERT INTO public.payslips (
      employee_id, organization_id, payroll_run_id, month, year,
      basic_salary, hra, special_allowance, conveyance_allowance, medical_allowance,
      other_allowances, allowances, bonus, overtime_hours, overtime_pay,
      gross_salary, pf_employee, pf_employer, esi_employee, esi_employer,
      professional_tax, tds, lop_days, lop_deduction, other_deductions,
      deductions, total_deductions, net_salary, working_days, present_days, leave_days,
      bank_name, account_number, pan_number, uan_number, status,
      earnings_breakdown, deductions_breakdown
    )
    VALUES (
      v_emp.id, _organization_id, v_run_id, _month, _year,
      v_basic, v_hra, v_special, v_conveyance, v_medical,
      v_other_allowances, (v_hra + v_special + v_conveyance + v_medical + v_other_allowances),
      0, v_overtime_hours, v_overtime_pay,
      v_gross, v_pf_emp, v_pf_empr, v_esi_emp, v_esi_empr,
      v_pt, v_tds, v_lop_days, v_lop_deduction, 0,
      v_total_deductions, v_total_deductions, v_net, v_working_days, v_present_days, v_unpaid_leave_days,
      COALESCE(v_struct.bank_name, v_emp.bank_name),
      COALESCE(v_struct.bank_account_number, v_emp.bank_account_number),
      COALESCE(v_struct.pan_number, v_emp.pan_number),
      v_struct.uan_number,
      'draft',
      jsonb_build_object(
        'basic', v_basic,
        'hra', v_hra,
        'special_allowance', v_special,
        'conveyance_allowance', v_conveyance,
        'medical_allowance', v_medical,
        'overtime_pay', v_overtime_pay
      ),
      jsonb_build_object(
        'pf_employee', v_pf_emp,
        'esi_employee', v_esi_emp,
        'professional_tax', v_pt,
        'tds', v_tds,
        'lop_deduction', v_lop_deduction
      )
    );

    v_tot_employees := v_tot_employees + 1;
    v_tot_gross := v_tot_gross + v_gross;
    v_tot_deductions := v_tot_deductions + v_total_deductions;
    v_tot_net := v_tot_net + v_net;
    v_tot_pf_emp := v_tot_pf_emp + v_pf_emp;
    v_tot_pf_empr := v_tot_pf_empr + v_pf_empr;
    v_tot_esi_emp := v_tot_esi_emp + v_esi_emp;
    v_tot_esi_empr := v_tot_esi_empr + v_esi_empr;
    v_tot_pt := v_tot_pt + v_pt;
    v_tot_tds := v_tot_tds + v_tds;
    v_tot_lop := v_tot_lop + v_lop_deduction;
  END LOOP;

  UPDATE public.payroll_runs
  SET
    total_employees = v_tot_employees,
    total_gross = v_tot_gross,
    total_deductions = v_tot_deductions,
    total_net = v_tot_net,
    total_pf_employee = v_tot_pf_emp,
    total_pf_employer = v_tot_pf_empr,
    total_esi_employee = v_tot_esi_emp,
    total_esi_employer = v_tot_esi_empr,
    total_pt = v_tot_pt,
    total_tds = v_tot_tds,
    total_lop_deductions = v_tot_lop,
    status = 'in_review',
    updated_at = now()
  WHERE id = v_run_id;

  INSERT INTO public.payroll_history (
    payroll_run_id, organization_id, changed_by_user_id, action, from_status, to_status, notes
  )
  VALUES (
    v_run_id, _organization_id, _user_id, 'calculated', 'draft', 'in_review',
    'Payroll calculated for ' || v_tot_employees || ' employees.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'payroll_run_id', v_run_id,
    'total_employees', v_tot_employees,
    'total_gross', v_tot_gross,
    'total_net', v_tot_net
  );
END;
$$;

-- 3. Upsert / edit any active employee's monthly payment in an unlocked payroll batch & sync totals
CREATE OR REPLACE FUNCTION public.update_employee_payslip(
  _payroll_run_id uuid,
  _employee_id uuid,
  _basic_salary numeric,
  _hra numeric DEFAULT 0,
  _special_allowance numeric DEFAULT 0,
  _conveyance_allowance numeric DEFAULT 0,
  _medical_allowance numeric DEFAULT 0,
  _other_allowances numeric DEFAULT 0,
  _bonus numeric DEFAULT 0,
  _overtime_pay numeric DEFAULT 0,
  _pf_employee numeric DEFAULT 0,
  _esi_employee numeric DEFAULT 0,
  _professional_tax numeric DEFAULT 0,
  _tds numeric DEFAULT 0,
  _lop_deduction numeric DEFAULT 0,
  _other_deductions numeric DEFAULT 0,
  _payment_method text DEFAULT 'bank_transfer',
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_run public.payroll_runs%ROWTYPE;
  v_emp public.employees%ROWTYPE;
  v_payslip_id uuid;
  v_allowances numeric(12,2);
  v_gross numeric(12,2);
  v_total_deductions numeric(12,2);
  v_net numeric(12,2);
  v_working_days integer;
  v_jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
BEGIN
  IF v_jwt_role = 'anon' OR (v_jwt_role = 'authenticated' AND v_user_id IS NULL) THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = _payroll_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll run not found.');
  END IF;

  IF v_user_id IS NOT NULL AND NOT public.is_org_admin(v_run.organization_id) THEN
    RAISE EXCEPTION 'Forbidden: only HR/Admin users can edit payroll payments.'
      USING ERRCODE = '42501';
  END IF;

  IF v_run.status IN ('locked', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Locked or paid payroll runs cannot be edited.');
  END IF;

  IF LEAST(
    COALESCE(_basic_salary, 0),
    COALESCE(_hra, 0),
    COALESCE(_special_allowance, 0),
    COALESCE(_conveyance_allowance, 0),
    COALESCE(_medical_allowance, 0),
    COALESCE(_other_allowances, 0),
    COALESCE(_bonus, 0),
    COALESCE(_overtime_pay, 0),
    COALESCE(_pf_employee, 0),
    COALESCE(_esi_employee, 0),
    COALESCE(_professional_tax, 0),
    COALESCE(_tds, 0),
    COALESCE(_lop_deduction, 0),
    COALESCE(_other_deductions, 0)
  ) < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll amounts must be zero or positive.');
  END IF;

  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = _employee_id AND organization_id = v_run.organization_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee does not belong to this organization.');
  END IF;

  v_allowances := ROUND(
    COALESCE(_hra, 0) + COALESCE(_special_allowance, 0) + COALESCE(_conveyance_allowance, 0) +
    COALESCE(_medical_allowance, 0) + COALESCE(_other_allowances, 0),
    2
  );
  v_gross := ROUND(
    COALESCE(_basic_salary, 0) + v_allowances + COALESCE(_bonus, 0) + COALESCE(_overtime_pay, 0),
    2
  );
  v_total_deductions := ROUND(
    COALESCE(_pf_employee, 0) + COALESCE(_esi_employee, 0) + COALESCE(_professional_tax, 0) +
    COALESCE(_tds, 0) + COALESCE(_lop_deduction, 0) + COALESCE(_other_deductions, 0),
    2
  );
  v_net := GREATEST(0, ROUND(v_gross - v_total_deductions, 2));
  v_working_days := EXTRACT(DAY FROM (make_date(v_run.year, v_run.month, 1) + interval '1 month - 1 day'))::integer;

  SELECT id INTO v_payslip_id
  FROM public.payslips
  WHERE payroll_run_id = _payroll_run_id AND employee_id = _employee_id
  LIMIT 1;

  IF v_payslip_id IS NOT NULL THEN
    UPDATE public.payslips
    SET
      basic_salary = ROUND(COALESCE(_basic_salary, 0), 2),
      hra = ROUND(COALESCE(_hra, 0), 2),
      special_allowance = ROUND(COALESCE(_special_allowance, 0), 2),
      conveyance_allowance = ROUND(COALESCE(_conveyance_allowance, 0), 2),
      medical_allowance = ROUND(COALESCE(_medical_allowance, 0), 2),
      other_allowances = ROUND(COALESCE(_other_allowances, 0), 2),
      allowances = v_allowances,
      bonus = ROUND(COALESCE(_bonus, 0), 2),
      overtime_pay = ROUND(COALESCE(_overtime_pay, 0), 2),
      gross_salary = v_gross,
      pf_employee = ROUND(COALESCE(_pf_employee, 0), 2),
      esi_employee = ROUND(COALESCE(_esi_employee, 0), 2),
      professional_tax = ROUND(COALESCE(_professional_tax, 0), 2),
      tds = ROUND(COALESCE(_tds, 0), 2),
      lop_deduction = ROUND(COALESCE(_lop_deduction, 0), 2),
      other_deductions = ROUND(COALESCE(_other_deductions, 0), 2),
      deductions = v_total_deductions,
      total_deductions = v_total_deductions,
      net_salary = v_net,
      payment_method = COALESCE(NULLIF(trim(_payment_method), ''), payment_method, 'bank_transfer'),
      notes = COALESCE(_notes, notes),
      earnings_breakdown = jsonb_build_object(
        'basic', ROUND(COALESCE(_basic_salary, 0), 2),
        'hra', ROUND(COALESCE(_hra, 0), 2),
        'special_allowance', ROUND(COALESCE(_special_allowance, 0), 2),
        'conveyance_allowance', ROUND(COALESCE(_conveyance_allowance, 0), 2),
        'medical_allowance', ROUND(COALESCE(_medical_allowance, 0), 2),
        'bonus', ROUND(COALESCE(_bonus, 0), 2),
        'overtime_pay', ROUND(COALESCE(_overtime_pay, 0), 2)
      ),
      deductions_breakdown = jsonb_build_object(
        'pf_employee', ROUND(COALESCE(_pf_employee, 0), 2),
        'esi_employee', ROUND(COALESCE(_esi_employee, 0), 2),
        'professional_tax', ROUND(COALESCE(_professional_tax, 0), 2),
        'tds', ROUND(COALESCE(_tds, 0), 2),
        'lop_deduction', ROUND(COALESCE(_lop_deduction, 0), 2),
        'other_deductions', ROUND(COALESCE(_other_deductions, 0), 2)
      )
    WHERE id = v_payslip_id;
  ELSE
    INSERT INTO public.payslips (
      employee_id, organization_id, payroll_run_id, month, year,
      basic_salary, hra, special_allowance, conveyance_allowance, medical_allowance,
      other_allowances, allowances, bonus, overtime_hours, overtime_pay,
      gross_salary, pf_employee, pf_employer, esi_employee, esi_employer,
      professional_tax, tds, lop_days, lop_deduction, other_deductions,
      deductions, total_deductions, net_salary, working_days, present_days, leave_days,
      bank_name, account_number, pan_number, status, payment_method, notes,
      earnings_breakdown, deductions_breakdown
    )
    VALUES (
      _employee_id, v_run.organization_id, _payroll_run_id, v_run.month, v_run.year,
      ROUND(COALESCE(_basic_salary, 0), 2), ROUND(COALESCE(_hra, 0), 2), ROUND(COALESCE(_special_allowance, 0), 2),
      ROUND(COALESCE(_conveyance_allowance, 0), 2), ROUND(COALESCE(_medical_allowance, 0), 2),
      ROUND(COALESCE(_other_allowances, 0), 2), v_allowances, ROUND(COALESCE(_bonus, 0), 2),
      0, ROUND(COALESCE(_overtime_pay, 0), 2), v_gross,
      ROUND(COALESCE(_pf_employee, 0), 2), 0, ROUND(COALESCE(_esi_employee, 0), 2), 0,
      ROUND(COALESCE(_professional_tax, 0), 2), ROUND(COALESCE(_tds, 0), 2),
      0, ROUND(COALESCE(_lop_deduction, 0), 2), ROUND(COALESCE(_other_deductions, 0), 2),
      v_total_deductions, v_total_deductions, v_net, v_working_days, v_working_days, 0,
      v_emp.bank_name, v_emp.bank_account_number, v_emp.pan_number,
      CASE WHEN v_run.status = 'approved' THEN 'approved' ELSE 'draft' END,
      COALESCE(NULLIF(trim(_payment_method), ''), 'bank_transfer'),
      _notes,
      jsonb_build_object(
        'basic', ROUND(COALESCE(_basic_salary, 0), 2),
        'hra', ROUND(COALESCE(_hra, 0), 2),
        'special_allowance', ROUND(COALESCE(_special_allowance, 0), 2),
        'conveyance_allowance', ROUND(COALESCE(_conveyance_allowance, 0), 2),
        'medical_allowance', ROUND(COALESCE(_medical_allowance, 0), 2),
        'bonus', ROUND(COALESCE(_bonus, 0), 2),
        'overtime_pay', ROUND(COALESCE(_overtime_pay, 0), 2)
      ),
      jsonb_build_object(
        'pf_employee', ROUND(COALESCE(_pf_employee, 0), 2),
        'esi_employee', ROUND(COALESCE(_esi_employee, 0), 2),
        'professional_tax', ROUND(COALESCE(_professional_tax, 0), 2),
        'tds', ROUND(COALESCE(_tds, 0), 2),
        'lop_deduction', ROUND(COALESCE(_lop_deduction, 0), 2),
        'other_deductions', ROUND(COALESCE(_other_deductions, 0), 2)
      )
    )
    RETURNING id INTO v_payslip_id;
  END IF;

  -- Recalculate batch totals atomically so header and payslips never diverge
  UPDATE public.payroll_runs
  SET
    total_employees = sub.cnt,
    total_gross = sub.tot_gross,
    total_deductions = sub.tot_ded,
    total_net = sub.tot_net,
    total_pf_employee = sub.tot_pf_emp,
    total_pf_employer = sub.tot_pf_empr,
    total_esi_employee = sub.tot_esi_emp,
    total_esi_employer = sub.tot_esi_empr,
    total_pt = sub.tot_pt,
    total_tds = sub.tot_tds,
    total_lop_deductions = sub.tot_lop,
    updated_at = now()
  FROM (
    SELECT
      COUNT(*)::integer AS cnt,
      COALESCE(SUM(gross_salary), 0)::numeric(14,2) AS tot_gross,
      COALESCE(SUM(total_deductions), 0)::numeric(14,2) AS tot_ded,
      COALESCE(SUM(net_salary), 0)::numeric(14,2) AS tot_net,
      COALESCE(SUM(pf_employee), 0)::numeric(14,2) AS tot_pf_emp,
      COALESCE(SUM(pf_employer), 0)::numeric(14,2) AS tot_pf_empr,
      COALESCE(SUM(esi_employee), 0)::numeric(14,2) AS tot_esi_emp,
      COALESCE(SUM(esi_employer), 0)::numeric(14,2) AS tot_esi_empr,
      COALESCE(SUM(professional_tax), 0)::numeric(14,2) AS tot_pt,
      COALESCE(SUM(tds), 0)::numeric(14,2) AS tot_tds,
      COALESCE(SUM(lop_deduction), 0)::numeric(14,2) AS tot_lop
    FROM public.payslips
    WHERE payroll_run_id = _payroll_run_id
  ) sub
  WHERE id = _payroll_run_id;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.payroll_history (
      payroll_run_id, organization_id, changed_by_user_id, action, from_status, to_status, notes
    )
    VALUES (
      _payroll_run_id, v_run.organization_id, v_user_id, 'adjusted', v_run.status, v_run.status,
      'Edited payment for ' || v_emp.full_name || ' (Net: ' || v_net || ')'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payslip_id', v_payslip_id,
    'gross_salary', v_gross,
    'total_deductions', v_total_deductions,
    'net_salary', v_net
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_employee_payslip(uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_employee_payslip(uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text) TO authenticated, service_role;
