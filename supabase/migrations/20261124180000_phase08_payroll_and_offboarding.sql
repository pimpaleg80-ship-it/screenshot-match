-- FLOWPEOPLE — PHASE 08: Payroll Management + Offboarding
-- Migration: 20261124180000_phase08_payroll_and_offboarding.sql

-- ============================================================================
-- 1. PAYROLL SETTINGS (Configurable Indian Statutory Rules)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pf_enabled boolean NOT NULL DEFAULT true,
  pf_employee_rate numeric(5,2) NOT NULL DEFAULT 12.00,
  pf_employer_rate numeric(5,2) NOT NULL DEFAULT 12.00,
  pf_wage_ceiling numeric(12,2) NOT NULL DEFAULT 15000.00,
  pf_ceiling_enabled boolean NOT NULL DEFAULT true,
  esi_enabled boolean NOT NULL DEFAULT true,
  esi_employee_rate numeric(5,2) NOT NULL DEFAULT 0.75,
  esi_employer_rate numeric(5,2) NOT NULL DEFAULT 3.25,
  esi_gross_ceiling numeric(12,2) NOT NULL DEFAULT 21000.00,
  pt_enabled boolean NOT NULL DEFAULT true,
  pt_default_state text NOT NULL DEFAULT 'Karnataka',
  pt_rules jsonb NOT NULL DEFAULT '[{"min": 0, "max": 14999, "amount": 0}, {"min": 15000, "max": 99999999, "amount": 200}]'::jsonb,
  working_days_method text NOT NULL DEFAULT 'calendar_days',
  overtime_multiplier numeric(4,2) NOT NULL DEFAULT 1.50,
  tds_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unq_payroll_settings_org UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_settings_org ON public.payroll_settings(organization_id);

-- Seed default payroll settings for any existing organization
INSERT INTO public.payroll_settings (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

-- ============================================================================
-- 2. EMPLOYEE SALARY STRUCTURES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_salary_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  ctc_annual numeric(12,2) NOT NULL DEFAULT 0,
  ctc_monthly numeric(12,2) NOT NULL DEFAULT 0,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  hra numeric(12,2) NOT NULL DEFAULT 0,
  special_allowance numeric(12,2) NOT NULL DEFAULT 0,
  conveyance_allowance numeric(12,2) NOT NULL DEFAULT 0,
  medical_allowance numeric(12,2) NOT NULL DEFAULT 0,
  other_allowances numeric(12,2) NOT NULL DEFAULT 0,
  pf_applicable boolean NOT NULL DEFAULT true,
  pf_cap_at_ceiling boolean NOT NULL DEFAULT true,
  esi_applicable boolean NOT NULL DEFAULT true,
  pt_applicable boolean NOT NULL DEFAULT true,
  pt_state text NOT NULL DEFAULT 'Karnataka',
  tds_monthly numeric(12,2) NOT NULL DEFAULT 0,
  uan_number text,
  pf_number text,
  esi_number text,
  pan_number text,
  bank_name text,
  bank_account_number text,
  bank_ifsc_code text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_structures_emp ON public.employee_salary_structures(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_structures_org ON public.employee_salary_structures(organization_id);

-- Seed initial salary structures for existing employees if none exist
INSERT INTO public.employee_salary_structures (
  employee_id, organization_id, effective_from,
  ctc_annual, ctc_monthly, basic_salary, hra, special_allowance,
  conveyance_allowance, medical_allowance, pf_applicable, esi_applicable, pt_applicable
)
SELECT 
  e.id, 
  e.organization_id, 
  COALESCE(e.joining_date, CURRENT_DATE),
  600000.00,
  50000.00,
  25000.00, -- 50% basic
  12500.00, -- 50% hra
  9500.00,
  1500.00,
  1500.00,
  true,
  false, -- gross > 21k
  true
FROM public.employees e
WHERE NOT EXISTS (
  SELECT 1 FROM public.employee_salary_structures s WHERE s.employee_id = e.id
);

-- ============================================================================
-- 3. PAYROLL RUNS (Monthly Batches)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, in_review, approved, locked, paid
  total_employees integer NOT NULL DEFAULT 0,
  total_gross numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  total_pf_employee numeric(14,2) NOT NULL DEFAULT 0,
  total_pf_employer numeric(14,2) NOT NULL DEFAULT 0,
  total_esi_employee numeric(14,2) NOT NULL DEFAULT 0,
  total_esi_employer numeric(14,2) NOT NULL DEFAULT 0,
  total_pt numeric(14,2) NOT NULL DEFAULT 0,
  total_tds numeric(14,2) NOT NULL DEFAULT 0,
  total_lop_deductions numeric(14,2) NOT NULL DEFAULT 0,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at timestamptz,
  payment_date date,
  payment_reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unq_payroll_runs_org_month_year UNIQUE (organization_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_org ON public.payroll_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_ym ON public.payroll_runs(year, month);

-- ============================================================================
-- 4. ENHANCE PAYSLIPS TABLE (Additive Columns)
-- ============================================================================
ALTER TABLE public.payslips 
  ADD COLUMN IF NOT EXISTS payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hra numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_allowance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conveyance_allowance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medical_allowance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowances numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_pay numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pf_employee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pf_employer numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS esi_employee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS esi_employer numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS professional_tax numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tds numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lop_days numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lop_deduction numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS working_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS present_days numeric(5,2) NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS leave_days numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS uan_number text,
  ADD COLUMN IF NOT EXISTS earnings_breakdown jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deductions_breakdown jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_payslips_payroll_run_id ON public.payslips(payroll_run_id);

-- ============================================================================
-- 5. PAYROLL HISTORY (Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  changed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  from_status text,
  to_status text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_history_run ON public.payroll_history(payroll_run_id);

-- ============================================================================
-- 6. OFFBOARDING & EXIT MANAGEMENT TABLES
-- ============================================================================

-- Add offboarding status fields to employees table (preserves record, never deletes)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS resignation_date date,
  ADD COLUMN IF NOT EXISTS last_working_date date,
  ADD COLUMN IF NOT EXISTS exit_status text DEFAULT 'none';

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_status_check 
  CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'resigned'::text, 'relieved'::text, 'terminated'::text, 'probation'::text, 'notice'::text]));

-- Employee Exits Table
CREATE TABLE IF NOT EXISTS public.employee_exits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  exit_type text NOT NULL DEFAULT 'resignation', -- resignation, termination, end_of_contract, retirement
  resignation_date date NOT NULL DEFAULT CURRENT_DATE,
  requested_last_working_day date NOT NULL,
  agreed_last_working_day date NOT NULL,
  notice_period_days integer NOT NULL DEFAULT 30,
  notice_waiver_days integer NOT NULL DEFAULT 0,
  reason_category text NOT NULL,
  employee_reason text NOT NULL,
  status text NOT NULL DEFAULT 'submitted', -- submitted, manager_approved, in_clearance, clearance_completed, fnf_settled, relieved, rejected, withdrawn
  manager_approval_status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  manager_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_approved_at timestamptz,
  manager_notes text,
  hr_approval_status text NOT NULL DEFAULT 'pending',
  hr_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hr_approved_at timestamptz,
  hr_notes text,
  exit_interview_status text NOT NULL DEFAULT 'pending', -- pending, scheduled, completed, waived
  clearance_status text NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
  fnf_status text NOT NULL DEFAULT 'pending', -- pending, calculated, approved, settled
  relieving_letter_issued boolean NOT NULL DEFAULT false,
  relieving_letter_issued_at timestamptz,
  experience_letter_issued boolean NOT NULL DEFAULT false,
  experience_letter_issued_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_exits_emp ON public.employee_exits(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_exits_org ON public.employee_exits(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_exits_status ON public.employee_exits(status);

-- Knowledge Transfer (KT) Tasks
CREATE TABLE IF NOT EXISTS public.exit_kt_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL REFERENCES public.employee_exits(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
  due_date date,
  completed_at timestamptz,
  sign_off_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exit_kt_tasks_exit ON public.exit_kt_tasks(exit_id);

-- Company Asset Returns
CREATE TABLE IF NOT EXISTS public.exit_asset_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL REFERENCES public.employee_exits(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'Hardware', -- Hardware, Peripherals, ID Card / Badge, Keys / Access Token, Other
  serial_number text,
  status text NOT NULL DEFAULT 'allocated', -- allocated, returned, damaged, lost, retained
  returned_date date,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  replacement_cost numeric(10,2) DEFAULT 0,
  condition_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exit_asset_returns_exit ON public.exit_asset_returns(exit_id);

-- Department Clearances (Manager, IT, Finance, HR)
CREATE TABLE IF NOT EXISTS public.exit_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL REFERENCES public.employee_exits(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_type text NOT NULL, -- Reporting Manager, IT & Security, Finance & Accounts, HR & Admin
  status text NOT NULL DEFAULT 'pending', -- pending, cleared, flagged
  cleared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cleared_at timestamptz,
  remarks text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unq_exit_clearance UNIQUE (exit_id, department_type)
);

CREATE INDEX IF NOT EXISTS idx_exit_clearances_exit ON public.exit_clearances(exit_id);

-- Exit Interviews
CREATE TABLE IF NOT EXISTS public.exit_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL REFERENCES public.employee_exits(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  conducted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conducted_at timestamptz DEFAULT now(),
  culture_rating integer CHECK (culture_rating >= 1 AND culture_rating <= 5),
  management_rating integer CHECK (management_rating >= 1 AND management_rating <= 5),
  growth_rating integer CHECK (growth_rating >= 1 AND growth_rating <= 5),
  compensation_rating integer CHECK (compensation_rating >= 1 AND compensation_rating <= 5),
  work_life_rating integer CHECK (work_life_rating >= 1 AND work_life_rating <= 5),
  would_recommend boolean DEFAULT true,
  positive_feedback text,
  improvement_areas text,
  reason_for_leaving text,
  confidential_notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unq_exit_interview UNIQUE (exit_id)
);

CREATE INDEX IF NOT EXISTS idx_exit_interviews_exit ON public.exit_interviews(exit_id);

-- Full & Final Settlement (FnF)
CREATE TABLE IF NOT EXISTS public.exit_fnf_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL REFERENCES public.employee_exits(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  settlement_date date NOT NULL DEFAULT CURRENT_DATE,
  working_days_in_final_month integer NOT NULL DEFAULT 30,
  payable_days_in_final_month numeric(5,2) NOT NULL DEFAULT 0,
  basic_salary_rate numeric(12,2) NOT NULL DEFAULT 0,
  unpaid_salary_amount numeric(12,2) NOT NULL DEFAULT 0,
  leave_encashment_days numeric(5,2) NOT NULL DEFAULT 0,
  leave_encashment_amount numeric(12,2) NOT NULL DEFAULT 0,
  gratuity_amount numeric(12,2) NOT NULL DEFAULT 0,
  bonus_incentives numeric(12,2) NOT NULL DEFAULT 0,
  pending_expense_claims numeric(12,2) NOT NULL DEFAULT 0,
  notice_shortfall_days integer NOT NULL DEFAULT 0,
  notice_recovery_amount numeric(12,2) NOT NULL DEFAULT 0,
  asset_deductions numeric(12,2) NOT NULL DEFAULT 0,
  statutory_deductions numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  total_earnings numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_payable numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', -- draft, approved, settled
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  settled_at timestamptz,
  payment_method text DEFAULT 'bank_transfer',
  payment_reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unq_exit_fnf UNIQUE (exit_id)
);

CREATE INDEX IF NOT EXISTS idx_exit_fnf_exit ON public.exit_fnf_settlements(exit_id);
CREATE INDEX IF NOT EXISTS idx_exit_fnf_emp ON public.exit_fnf_settlements(employee_id);

-- Exit History (Audit Trail)
CREATE TABLE IF NOT EXISTS public.exit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL REFERENCES public.employee_exits(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  changed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  from_status text,
  to_status text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exit_history_exit ON public.exit_history(exit_id);

-- ============================================================================
-- 7. STORAGE BUCKET FOR EXIT DOCUMENTS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exit-documents',
  'exit-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760;

-- Storage RLS Policies
DROP POLICY IF EXISTS "exit_docs_admin_manage" ON storage.objects;
CREATE POLICY "exit_docs_admin_manage" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'exit-documents' AND (
      public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'exit-documents' AND (
      public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "exit_docs_employee_read" ON storage.objects;
CREATE POLICY "exit_docs_employee_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exit-documents' AND (
      (storage.foldername(name))[1] = public.current_employee_id()::text
      OR public.has_role(auth.uid(), 'admin')
      OR public.is_superadmin(auth.uid())
    )
  );

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_exits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_kt_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_asset_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_clearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_fnf_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_history ENABLE ROW LEVEL SECURITY;

-- 8.1 Payroll Settings RLS
DROP POLICY IF EXISTS "payroll_settings_admin_all" ON public.payroll_settings;
CREATE POLICY "payroll_settings_admin_all" ON public.payroll_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "payroll_settings_read_auth" ON public.payroll_settings;
CREATE POLICY "payroll_settings_read_auth" ON public.payroll_settings
  FOR SELECT TO authenticated
  USING (true);

-- 8.2 Salary Structures RLS
DROP POLICY IF EXISTS "salary_structures_admin_all" ON public.employee_salary_structures;
CREATE POLICY "salary_structures_admin_all" ON public.employee_salary_structures
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "salary_structures_emp_select" ON public.employee_salary_structures;
CREATE POLICY "salary_structures_emp_select" ON public.employee_salary_structures
  FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id());

-- 8.3 Payroll Runs RLS
DROP POLICY IF EXISTS "payroll_runs_admin_all" ON public.payroll_runs;
CREATE POLICY "payroll_runs_admin_all" ON public.payroll_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "payroll_runs_manager_select" ON public.payroll_runs;
CREATE POLICY "payroll_runs_manager_select" ON public.payroll_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- 8.4 Payroll History RLS
DROP POLICY IF EXISTS "payroll_history_admin_all" ON public.payroll_history;
CREATE POLICY "payroll_history_admin_all" ON public.payroll_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- 8.5 Payslips RLS (Update existing)
DROP POLICY IF EXISTS "payslips_admin_all" ON public.payslips;
CREATE POLICY "payslips_admin_all" ON public.payslips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "payslips_employee_select" ON public.payslips;
CREATE POLICY "payslips_employee_select" ON public.payslips
  FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() AND status = 'published');

-- 8.6 Employee Exits RLS
DROP POLICY IF EXISTS "employee_exits_admin_all" ON public.employee_exits;
CREATE POLICY "employee_exits_admin_all" ON public.employee_exits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "employee_exits_manager_select" ON public.employee_exits;
CREATE POLICY "employee_exits_manager_select" ON public.employee_exits
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND
    public.is_my_team_member(employee_id)
  );

DROP POLICY IF EXISTS "employee_exits_emp_own" ON public.employee_exits;
CREATE POLICY "employee_exits_emp_own" ON public.employee_exits
  FOR ALL TO authenticated
  USING (employee_id = public.current_employee_id())
  WITH CHECK (employee_id = public.current_employee_id());

-- 8.7 Exit Sub-tables RLS (KT Tasks, Asset Returns, Clearances, Interviews, FnF, History)
DROP POLICY IF EXISTS "exit_kt_admin_all" ON public.exit_kt_tasks;
CREATE POLICY "exit_kt_admin_all" ON public.exit_kt_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "exit_kt_emp_select" ON public.exit_kt_tasks;
CREATE POLICY "exit_kt_emp_select" ON public.exit_kt_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_exits ee
      WHERE ee.id = exit_kt_tasks.exit_id
      AND (ee.employee_id = public.current_employee_id() OR exit_kt_tasks.assigned_to_employee_id = public.current_employee_id())
    )
  );

DROP POLICY IF EXISTS "exit_assets_admin_all" ON public.exit_asset_returns;
CREATE POLICY "exit_assets_admin_all" ON public.exit_asset_returns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "exit_assets_emp_select" ON public.exit_asset_returns;
CREATE POLICY "exit_assets_emp_select" ON public.exit_asset_returns
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_exits ee
      WHERE ee.id = exit_asset_returns.exit_id
      AND ee.employee_id = public.current_employee_id()
    )
  );

DROP POLICY IF EXISTS "exit_clearances_admin_all" ON public.exit_clearances;
CREATE POLICY "exit_clearances_admin_all" ON public.exit_clearances
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "exit_clearances_emp_select" ON public.exit_clearances;
CREATE POLICY "exit_clearances_emp_select" ON public.exit_clearances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_exits ee
      WHERE ee.id = exit_clearances.exit_id
      AND ee.employee_id = public.current_employee_id()
    )
  );

DROP POLICY IF EXISTS "exit_interviews_admin_all" ON public.exit_interviews;
CREATE POLICY "exit_interviews_admin_all" ON public.exit_interviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "exit_interviews_emp_all" ON public.exit_interviews;
CREATE POLICY "exit_interviews_emp_all" ON public.exit_interviews
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_exits ee
      WHERE ee.id = exit_interviews.exit_id
      AND ee.employee_id = public.current_employee_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_exits ee
      WHERE ee.id = exit_interviews.exit_id
      AND ee.employee_id = public.current_employee_id()
    )
  );

DROP POLICY IF EXISTS "exit_fnf_admin_all" ON public.exit_fnf_settlements;
CREATE POLICY "exit_fnf_admin_all" ON public.exit_fnf_settlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "exit_fnf_emp_select" ON public.exit_fnf_settlements;
CREATE POLICY "exit_fnf_emp_select" ON public.exit_fnf_settlements
  FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "exit_history_admin_all" ON public.exit_history;
CREATE POLICY "exit_history_admin_all" ON public.exit_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "exit_history_emp_select" ON public.exit_history;
CREATE POLICY "exit_history_emp_select" ON public.exit_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_exits ee
      WHERE ee.id = exit_history.exit_id
      AND ee.employee_id = public.current_employee_id()
    )
  );

-- ============================================================================
-- 9. TRANSACTIONAL POSTGRESQL FUNCTIONS (RPC)
-- ============================================================================

-- 9.1 Calculate & Generate Monthly Payroll Run
CREATE OR REPLACE FUNCTION public.calculate_monthly_payroll_run(
  _organization_id uuid,
  _year integer,
  _month integer,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Run Totals
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
BEGIN
  -- 1. Check or fetch payroll settings
  SELECT * INTO v_settings FROM public.payroll_settings 
  WHERE organization_id = _organization_id;

  IF NOT FOUND THEN
    INSERT INTO public.payroll_settings (organization_id)
    VALUES (_organization_id)
    RETURNING * INTO v_settings;
  END IF;

  -- 2. Determine month date range & standard working days
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

  -- 3. Upsert payroll_run header
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

  -- Prevent recalculation if locked
  IF EXISTS (SELECT 1 FROM public.payroll_runs WHERE id = v_run_id AND status = 'locked') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll run is locked and cannot be recalculated.');
  END IF;

  -- 4. Delete existing draft payslips for this run to allow clean recalculation
  DELETE FROM public.payslips WHERE payroll_run_id = v_run_id;

  -- 5. Iterate over active employees in the organization
  FOR v_emp IN 
    SELECT e.id, e.full_name, e.employee_code, e.bank_name, e.bank_account_number, e.pan_number
    FROM public.employees e
    WHERE e.organization_id = _organization_id
      AND e.status NOT IN ('relieved', 'terminated')
  LOOP
    -- Fetch active salary structure or build default
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
      -- Standard default structure
      v_basic := 25000.00;
      v_hra := 12500.00;
      v_special := 9500.00;
      v_conveyance := 1500.00;
      v_medical := 1500.00;
      v_other_allowances := 0;
    END IF;

    -- Query attendance for present days & overtime
    SELECT 
      COALESCE(COUNT(*), 0),
      COALESCE(SUM(overtime_hours), 0)
    INTO v_present_days, v_overtime_hours
    FROM public.attendance
    WHERE employee_id = v_emp.id
      AND date >= v_start_date AND date <= v_end_date
      AND status IN ('present', 'late', 'half_day');

    -- Count approved leave days
    SELECT COALESCE(SUM(days), 0)
    INTO v_unpaid_leave_days
    FROM public.leave_requests
    WHERE employee_id = v_emp.id
      AND status = 'approved'
      AND from_date <= v_end_date AND to_date >= v_start_date;

    -- If present_days is 0 (e.g. attendance records not yet punched), default to full working days
    IF v_present_days = 0 AND v_unpaid_leave_days = 0 THEN
      v_present_days := v_working_days;
      v_lop_days := 0;
    ELSE
      v_lop_days := GREATEST(0, v_working_days - (v_present_days + v_unpaid_leave_days));
    END IF;

    -- Overtime calculation
    v_overtime_pay := ROUND((v_overtime_hours * ((v_basic / v_working_days) / 8.0) * v_settings.overtime_multiplier), 2);

    -- Gross calculation
    v_gross := v_basic + v_hra + v_special + v_conveyance + v_medical + v_other_allowances + v_overtime_pay;

    -- LOP calculation
    v_lop_deduction := ROUND(((v_gross / v_working_days) * v_lop_days), 2);

    -- PF calculation
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

    -- ESI calculation (eligible if gross <= esi_gross_ceiling, standard ₹21,000)
    IF v_settings.esi_enabled AND v_gross <= v_settings.esi_gross_ceiling AND (v_struct.esi_applicable IS NULL OR v_struct.esi_applicable = true) THEN
      v_esi_emp := ROUND((v_gross * (v_settings.esi_employee_rate / 100.0)), 2);
      v_esi_empr := ROUND((v_gross * (v_settings.esi_employer_rate / 100.0)), 2);
    ELSE
      v_esi_emp := 0;
      v_esi_empr := 0;
    END IF;

    -- Professional Tax (PT)
    IF v_settings.pt_enabled AND (v_struct.pt_applicable IS NULL OR v_struct.pt_applicable = true) THEN
      IF v_gross >= 15000 THEN
        v_pt := 200.00;
      ELSE
        v_pt := 0.00;
      END IF;
    ELSE
      v_pt := 0;
    END IF;

    -- TDS
    v_tds := COALESCE(v_struct.tds_monthly, 0.00);

    -- Net Pay
    v_total_deductions := v_pf_emp + v_esi_emp + v_pt + v_tds + v_lop_deduction;
    v_net := GREATEST(0, v_gross - v_total_deductions);

    -- Insert into payslips
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

    -- Accumulate Totals
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

  -- Update payroll_runs summary
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

  -- Insert history record
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

-- 9.2 Approve Payroll Run
CREATE OR REPLACE FUNCTION public.approve_payroll_run(
  _payroll_run_id uuid,
  _user_id uuid,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run public.payroll_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM public.payroll_runs WHERE id = _payroll_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll run not found.');
  END IF;

  IF v_run.status = 'locked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll run is locked.');
  END IF;

  UPDATE public.payroll_runs
  SET 
    status = 'approved',
    approved_by = _user_id,
    approved_at = now(),
    notes = COALESCE(_notes, notes),
    updated_at = now()
  WHERE id = _payroll_run_id;

  -- Update payslips status to approved
  UPDATE public.payslips
  SET status = 'approved'
  WHERE payroll_run_id = _payroll_run_id;

  INSERT INTO public.payroll_history (
    payroll_run_id, organization_id, changed_by_user_id, action, from_status, to_status, notes
  )
  VALUES (
    _payroll_run_id, v_run.organization_id, _user_id, 'approved', v_run.status, 'approved', _notes
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 9.3 Lock & Finalize Payroll Run (Publishes Payslips)
CREATE OR REPLACE FUNCTION public.lock_payroll_run(
  _payroll_run_id uuid,
  _user_id uuid,
  _payment_date date DEFAULT CURRENT_DATE,
  _payment_ref text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run public.payroll_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM public.payroll_runs WHERE id = _payroll_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll run not found.');
  END IF;

  IF v_run.status = 'locked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll run is already locked.');
  END IF;

  UPDATE public.payroll_runs
  SET 
    status = 'locked',
    locked_by = _user_id,
    locked_at = now(),
    payment_date = _payment_date,
    payment_reference = _payment_ref,
    notes = COALESCE(_notes, notes),
    updated_at = now()
  WHERE id = _payroll_run_id;

  -- Publish all payslips so employees can view/download
  UPDATE public.payslips
  SET 
    status = 'published',
    payment_date = _payment_date
  WHERE payroll_run_id = _payroll_run_id;

  INSERT INTO public.payroll_history (
    payroll_run_id, organization_id, changed_by_user_id, action, from_status, to_status, notes
  )
  VALUES (
    _payroll_run_id, v_run.organization_id, _user_id, 'locked', v_run.status, 'locked',
    COALESCE(_notes, 'Locked and published payslips with payment reference ' || COALESCE(_payment_ref, 'N/A'))
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 9.4 Submit Employee Resignation
CREATE OR REPLACE FUNCTION public.submit_employee_resignation(
  _employee_id uuid,
  _requested_lwd date,
  _reason_category text,
  _employee_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_exit_id uuid;
  v_notice_days integer;
  v_calculated_lwd date;
BEGIN
  SELECT * INTO v_emp FROM public.employees WHERE id = _employee_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found.');
  END IF;

  v_notice_days := COALESCE(v_emp.notice_period_days, 30);
  v_calculated_lwd := CURRENT_DATE + (v_notice_days || ' days')::interval;

  -- Create resignation record
  INSERT INTO public.employee_exits (
    employee_id, organization_id, resignation_date, requested_last_working_day,
    agreed_last_working_day, notice_period_days, reason_category, employee_reason,
    status, manager_approval_status, hr_approval_status
  )
  VALUES (
    _employee_id, v_emp.organization_id, CURRENT_DATE, _requested_lwd,
    COALESCE(_requested_lwd, v_calculated_lwd), v_notice_days, _reason_category, _employee_reason,
    'submitted', 'pending', 'pending'
  )
  RETURNING id INTO v_exit_id;

  -- Create default department clearances
  INSERT INTO public.exit_clearances (exit_id, organization_id, department_type, status)
  VALUES
    (v_exit_id, v_emp.organization_id, 'Reporting Manager', 'pending'),
    (v_exit_id, v_emp.organization_id, 'IT & Security', 'pending'),
    (v_exit_id, v_emp.organization_id, 'Finance & Accounts', 'pending'),
    (v_exit_id, v_emp.organization_id, 'HR & Admin', 'pending')
  ON CONFLICT DO NOTHING;

  -- Create standard KT task placeholder
  INSERT INTO public.exit_kt_tasks (exit_id, organization_id, title, description, due_date)
  VALUES (
    v_exit_id, v_emp.organization_id,
    'Project Documentation & Code Handover',
    'Prepare comprehensive transition document and conduct handover sessions with designated peer.',
    _requested_lwd - 3
  );

  -- Create company asset placeholders
  INSERT INTO public.exit_asset_returns (exit_id, organization_id, asset_name, asset_type)
  VALUES
    (v_exit_id, v_emp.organization_id, 'Company Laptop & Charger', 'Hardware'),
    (v_exit_id, v_emp.organization_id, 'Corporate ID Badge & Access Card', 'ID Card / Badge')
  ON CONFLICT DO NOTHING;

  -- Audit history
  INSERT INTO public.exit_history (
    exit_id, organization_id, changed_by_user_id, action, from_status, to_status, notes
  )
  VALUES (
    v_exit_id, v_emp.organization_id, auth.uid(), 'submitted', 'none', 'submitted',
    'Resignation submitted by employee. Notice period: ' || v_notice_days || ' days.'
  );

  RETURN jsonb_build_object('success', true, 'exit_id', v_exit_id);
END;
$$;

-- 9.5 Review Employee Resignation (Manager / HR)
CREATE OR REPLACE FUNCTION public.review_employee_resignation(
  _exit_id uuid,
  _reviewer_id uuid,
  _action text, -- 'approve' | 'reject'
  _agreed_lwd date DEFAULT NULL,
  _notice_waiver integer DEFAULT 0,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exit public.employee_exits%ROWTYPE;
  v_next_status text;
BEGIN
  SELECT * INTO v_exit FROM public.employee_exits WHERE id = _exit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exit record not found.');
  END IF;

  IF _action = 'approve' THEN
    v_next_status := 'in_clearance';

    UPDATE public.employee_exits
    SET 
      status = v_next_status,
      manager_approval_status = 'approved',
      manager_approved_by = _reviewer_id,
      manager_approved_at = now(),
      hr_approval_status = 'approved',
      hr_approved_by = _reviewer_id,
      hr_approved_at = now(),
      agreed_last_working_day = COALESCE(_agreed_lwd, agreed_last_working_day),
      notice_waiver_days = COALESCE(_notice_waiver, notice_waiver_days),
      manager_notes = COALESCE(_notes, manager_notes),
      updated_at = now()
    WHERE id = _exit_id;

    -- Update employee status to 'resigned' and record dates (NEVER delete)
    UPDATE public.employees
    SET 
      status = 'resigned',
      resignation_date = v_exit.resignation_date,
      last_working_date = COALESCE(_agreed_lwd, v_exit.agreed_last_working_day),
      exit_status = 'in_clearance',
      updated_at = now()
    WHERE id = v_exit.employee_id;

  ELSE
    v_next_status := 'rejected';

    UPDATE public.employee_exits
    SET 
      status = v_next_status,
      manager_approval_status = 'rejected',
      hr_approval_status = 'rejected',
      manager_notes = COALESCE(_notes, manager_notes),
      updated_at = now()
    WHERE id = _exit_id;
  END IF;

  INSERT INTO public.exit_history (
    exit_id, organization_id, changed_by_user_id, action, from_status, to_status, notes
  )
  VALUES (
    _exit_id, v_exit.organization_id, _reviewer_id, _action, v_exit.status, v_next_status, _notes
  );

  RETURN jsonb_build_object('success', true, 'status', v_next_status);
END;
$$;

-- 9.6 Finalize Employee Exit & Settlement
CREATE OR REPLACE FUNCTION public.finalize_employee_exit(
  _exit_id uuid,
  _user_id uuid,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exit public.employee_exits%ROWTYPE;
BEGIN
  SELECT * INTO v_exit FROM public.employee_exits WHERE id = _exit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exit record not found.');
  END IF;

  -- Update employee exit status to relieved
  UPDATE public.employee_exits
  SET 
    status = 'relieved',
    clearance_status = 'completed',
    fnf_status = 'settled',
    relieving_letter_issued = true,
    relieving_letter_issued_at = now(),
    experience_letter_issued = true,
    experience_letter_issued_at = now(),
    updated_at = now()
  WHERE id = _exit_id;

  -- Mark employee record as relieved (preserves all historical data)
  UPDATE public.employees
  SET 
    status = 'relieved',
    exit_status = 'relieved',
    last_working_date = v_exit.agreed_last_working_day,
    updated_at = now()
  WHERE id = v_exit.employee_id;

  -- Audit history
  INSERT INTO public.exit_history (
    exit_id, organization_id, changed_by_user_id, action, from_status, to_status, notes
  )
  VALUES (
    _exit_id, v_exit.organization_id, _user_id, 'relieved', v_exit.status, 'relieved',
    COALESCE(_notes, 'Exit finalized. Clearances, FnF settled, Relieving and Experience certificates issued.')
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
