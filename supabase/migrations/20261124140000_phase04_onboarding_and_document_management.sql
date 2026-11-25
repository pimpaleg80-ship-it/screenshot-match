-- 20261124140000_phase04_onboarding_and_document_management.sql
-- FLOWPEOPLE PHASE 04: Employee Onboarding + Document Management
-- Additive migration for document categories, enhanced document properties,
-- onboarding templates, checklists, candidate onboarding workflows, and RLS.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- 1. DOCUMENT CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  code text,
  description text,
  is_system boolean DEFAULT false,
  requires_expiry boolean DEFAULT false,
  requires_verification boolean DEFAULT true,
  color text DEFAULT '#4f46e5',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed default standard system document categories
INSERT INTO public.document_categories (name, code, description, is_system, requires_expiry, requires_verification, color)
SELECT 'Identity Documents', 'ID_DOC', 'Government issued identification: Passport, National ID, Driving License, PAN', true, true, true, '#3b82f6'
WHERE NOT EXISTS (SELECT 1 FROM public.document_categories WHERE code = 'ID_DOC');

INSERT INTO public.document_categories (name, code, description, is_system, requires_expiry, requires_verification, color)
SELECT 'Educational Certificates', 'EDU_CERT', 'Degrees, diplomas, academic transcripts, and professional certifications', true, false, true, '#10b981'
WHERE NOT EXISTS (SELECT 1 FROM public.document_categories WHERE code = 'EDU_CERT');

INSERT INTO public.document_categories (name, code, description, is_system, requires_expiry, requires_verification, color)
SELECT 'Experience Certificates', 'EXP_CERT', 'Prior service letters, relieving certificates, and recommendation letters', true, false, true, '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM public.document_categories WHERE code = 'EXP_CERT');

INSERT INTO public.document_categories (name, code, description, is_system, requires_expiry, requires_verification, color)
SELECT 'Employment Contracts & Agreements', 'EMP_AGMT', 'Offer letters, employment contracts, NDAs, and non-compete agreements', true, false, true, '#f59e0b'
WHERE NOT EXISTS (SELECT 1 FROM public.document_categories WHERE code = 'EMP_AGMT');

INSERT INTO public.document_categories (name, code, description, is_system, requires_expiry, requires_verification, color)
SELECT 'Company Policies & Handbooks', 'COMPANY_POLICY', 'Official organization policies, employee handbook, security protocols', true, false, false, '#06b6d4'
WHERE NOT EXISTS (SELECT 1 FROM public.document_categories WHERE code = 'COMPANY_POLICY');

INSERT INTO public.document_categories (name, code, description, is_system, requires_expiry, requires_verification, color)
SELECT 'Financial & Tax Records', 'FIN_TAX', 'Bank account proofs, cancelled cheques, tax filings, and Form 16 / W2', true, false, true, '#ec4899'
WHERE NOT EXISTS (SELECT 1 FROM public.document_categories WHERE code = 'FIN_TAX');

-- ============================================================================
-- 2. EXTEND PUBLIC.DOCUMENTS TABLE
-- ============================================================================
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS issue_date date,
ADD COLUMN IF NOT EXISTS expiry_date date,
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending_verification',
ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.document_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_company_policy boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS target_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_confidential boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_documents_category_id ON public.documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_verification_status ON public.documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON public.documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_documents_is_company_policy ON public.documents(is_company_policy);

-- ============================================================================
-- 3. EXTEND PUBLIC.EMPLOYEES TABLE FOR ONBOARDING & BANK INFO
-- ============================================================================
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_account_number text,
ADD COLUMN IF NOT EXISTS bank_ifsc_code text,
ADD COLUMN IF NOT EXISTS bank_branch text,
ADD COLUMN IF NOT EXISTS bank_account_holder text,
ADD COLUMN IF NOT EXISTS pan_number text,
ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'completed';

CREATE INDEX IF NOT EXISTS idx_employees_onboarding_status ON public.employees(onboarding_status);

-- ============================================================================
-- 4. ONBOARDING TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed default onboarding template
INSERT INTO public.onboarding_templates (name, description, is_default)
SELECT 'Standard Full-Time Employee Onboarding', 'Comprehensive joining checklist covering personal details, bank accounts, mandatory document collection, IT provisioning, and policy sign-offs.', true
WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_templates WHERE is_default = true);

-- ============================================================================
-- 5. ONBOARDING CHECKLIST ITEMS (TEMPLATE TASKS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.onboarding_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'document',
  required boolean DEFAULT true,
  order_index integer DEFAULT 0,
  document_category text,
  created_at timestamptz DEFAULT now()
);

-- Seed standard items into default template
DO $$
DECLARE
  v_template_id uuid;
BEGIN
  SELECT id INTO v_template_id FROM public.onboarding_templates WHERE is_default = true LIMIT 1;
  IF v_template_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.onboarding_checklist_items WHERE template_id = v_template_id) THEN
    INSERT INTO public.onboarding_checklist_items (template_id, title, description, category, required, order_index, document_category)
    VALUES
      (v_template_id, 'Submit Personal & Emergency Contact Information', 'Verify contact numbers, emergency relatives, and blood group', 'personal_info', true, 1, NULL),
      (v_template_id, 'Provide Bank Account & Tax Details', 'Submit account number, bank name, IFSC/SWIFT code, and PAN card for payroll', 'bank_details', true, 2, NULL),
      (v_template_id, 'Upload Government Identity Proof', 'Upload valid Passport, National Identity Card, Driving License, or Aadhaar', 'document', true, 3, 'Identity Documents'),
      (v_template_id, 'Upload Educational Degree Certificate', 'Highest degree certificate or final transcript', 'document', true, 4, 'Educational Certificates'),
      (v_template_id, 'Upload Previous Relieving / Experience Letter', 'Experience letter or resignation acceptance from previous employer', 'document', false, 5, 'Experience Certificates'),
      (v_template_id, 'Sign & Return Offer Letter', 'Review, sign, and upload accepted offer letter copy', 'document', true, 6, 'Employment Contracts & Agreements'),
      (v_template_id, 'Acknowledge Employee Handbook & NDA', 'Read and digitally acknowledge company code of conduct and confidential disclosure agreement', 'policy_sign', true, 7, NULL),
      (v_template_id, 'IT Provisioning & System Access', 'Workstation allocation, official Google/email account, and Slack access', 'it_setup', true, 8, NULL),
      (v_template_id, 'HR Welcome Orientation Session', 'Complete introductory orientation session with the People team', 'hr_verification', true, 9, NULL),
      (v_template_id, 'Final HR Verification & Activation Sign-off', 'Review submitted documents, activate attendance profile, and allocate annual leave ledger', 'hr_verification', true, 10, NULL);
  END IF;
END $$;

-- ============================================================================
-- 6. EMPLOYEE ONBOARDING PIPELINE INSTANCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid,
  template_id uuid REFERENCES public.onboarding_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress',
  progress_percentage integer DEFAULT 0,
  target_completion_date date,
  completed_at timestamptz,
  hr_reviewer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  hr_notes text,
  offer_letter_url text,
  offer_letter_accepted_at timestamptz,
  employment_agreement_url text,
  employment_agreement_accepted_at timestamptz,
  bank_name text,
  bank_account_number text,
  bank_ifsc_code text,
  bank_branch text,
  bank_account_holder text,
  pan_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_employee ON public.employee_onboarding(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_onboarding_status ON public.employee_onboarding(status);
CREATE INDEX IF NOT EXISTS idx_employee_onboarding_org ON public.employee_onboarding(organization_id);

-- ============================================================================
-- 7. EMPLOYEE ONBOARDING TASKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES public.employee_onboarding(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'document',
  required boolean DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  rejection_notes text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_onboarding ON public.employee_onboarding_tasks(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_employee ON public.employee_onboarding_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_status ON public.employee_onboarding_tasks(status);

-- ============================================================================
-- 8. STORAGE BUCKETS CONFIGURATION (PRIVATE STORAGE)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ============================================================================
-- 9. HELPER & TRANSACTIONAL FUNCTIONS
-- ============================================================================

-- A. Helper: Recalculate Onboarding Progress Percentage
CREATE OR REPLACE FUNCTION public.recalculate_onboarding_progress(p_onboarding_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_tasks integer;
  v_completed_tasks integer;
  v_pct integer := 0;
BEGIN
  SELECT count(*) INTO v_total_tasks
  FROM public.employee_onboarding_tasks
  WHERE onboarding_id = p_onboarding_id;

  IF v_total_tasks = 0 THEN
    RETURN 100;
  END IF;

  SELECT count(*) INTO v_completed_tasks
  FROM public.employee_onboarding_tasks
  WHERE onboarding_id = p_onboarding_id
    AND status IN ('completed', 'verified', 'skipped');

  v_pct := ROUND((v_completed_tasks::numeric / v_total_tasks::numeric) * 100);

  UPDATE public.employee_onboarding
  SET progress_percentage = v_pct,
      updated_at = now()
  WHERE id = p_onboarding_id;

  RETURN v_pct;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_onboarding_progress(uuid) TO authenticated;

-- B. Transactional: Start Employee Onboarding
CREATE OR REPLACE FUNCTION public.start_employee_onboarding(
  p_employee_id uuid,
  p_template_id uuid DEFAULT NULL,
  p_target_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp record;
  v_tmpl_id uuid := p_template_id;
  v_onboarding_id uuid;
  v_item record;
BEGIN
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee record not found for id %', p_employee_id;
  END IF;

  -- Pick default template if none supplied
  IF v_tmpl_id IS NULL THEN
    SELECT id INTO v_tmpl_id FROM public.onboarding_templates WHERE is_default = true LIMIT 1;
    IF v_tmpl_id IS NULL THEN
      SELECT id INTO v_tmpl_id FROM public.onboarding_templates LIMIT 1;
    END IF;
  END IF;

  -- Create or reuse existing active onboarding
  SELECT id INTO v_onboarding_id
  FROM public.employee_onboarding
  WHERE employee_id = p_employee_id AND status IN ('in_progress', 'draft', 'pending_hr_review')
  LIMIT 1;

  IF v_onboarding_id IS NULL THEN
    INSERT INTO public.employee_onboarding (
      employee_id,
      organization_id,
      template_id,
      status,
      target_completion_date,
      bank_name,
      bank_account_number,
      bank_ifsc_code,
      bank_branch,
      bank_account_holder,
      pan_number
    ) VALUES (
      p_employee_id,
      v_emp.organization_id,
      v_tmpl_id,
      'in_progress',
      COALESCE(p_target_date, (CURRENT_DATE + interval '14 days')::date),
      v_emp.bank_name,
      v_emp.bank_account_number,
      v_emp.bank_ifsc_code,
      v_emp.bank_branch,
      v_emp.bank_account_holder,
      v_emp.pan_number
    ) RETURNING id INTO v_onboarding_id;

    -- Copy checklist tasks from template
    IF v_tmpl_id IS NOT NULL THEN
      FOR v_item IN
        SELECT * FROM public.onboarding_checklist_items
        WHERE template_id = v_tmpl_id
        ORDER BY order_index ASC
      LOOP
        INSERT INTO public.employee_onboarding_tasks (
          onboarding_id,
          employee_id,
          title,
          description,
          category,
          required,
          status,
          order_index
        ) VALUES (
          v_onboarding_id,
          p_employee_id,
          v_item.title,
          v_item.description,
          v_item.category,
          v_item.required,
          'pending',
          v_item.order_index
        );
      END LOOP;
    END IF;
  END IF;

  -- Update employee onboarding status
  UPDATE public.employees
  SET onboarding_status = 'in_progress',
      updated_at = now()
  WHERE id = p_employee_id;

  PERFORM public.recalculate_onboarding_progress(v_onboarding_id);

  RETURN jsonb_build_object(
    'success', true,
    'onboarding_id', v_onboarding_id,
    'employee_id', p_employee_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_employee_onboarding(uuid, uuid, date) TO authenticated;

-- C. Transactional: Submit / Update Onboarding Task
CREATE OR REPLACE FUNCTION public.submit_onboarding_task(
  p_task_id uuid,
  p_document_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task record;
  v_onboarding_id uuid;
BEGIN
  SELECT * INTO v_task FROM public.employee_onboarding_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  v_onboarding_id := v_task.onboarding_id;

  UPDATE public.employee_onboarding_tasks
  SET status = CASE WHEN category = 'document' THEN 'submitted' ELSE 'completed' END,
      document_id = COALESCE(p_document_id, document_id),
      rejection_notes = NULL,
      completed_by = auth.uid(),
      completed_at = now()
  WHERE id = p_task_id;

  PERFORM public.recalculate_onboarding_progress(v_onboarding_id);

  -- Check if all tasks submitted/completed, move onboarding to pending_hr_review
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_onboarding_tasks
    WHERE onboarding_id = v_onboarding_id
      AND required = true
      AND status = 'pending'
  ) THEN
    UPDATE public.employee_onboarding
    SET status = 'pending_hr_review',
        updated_at = now()
    WHERE id = v_onboarding_id AND status = 'in_progress';

    UPDATE public.employees
    SET onboarding_status = 'pending_review',
        updated_at = now()
    WHERE id = v_task.employee_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'task_id', p_task_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_onboarding_task(uuid, uuid, text) TO authenticated;

-- D. Transactional: Verify Document & Task
CREATE OR REPLACE FUNCTION public.verify_employee_document(
  p_document_id uuid,
  p_status text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc record;
  v_reviewer_emp_id uuid;
BEGIN
  SELECT * INTO v_doc FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  SELECT id INTO v_reviewer_emp_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;

  UPDATE public.documents
  SET verification_status = p_status,
      verified_by = v_reviewer_emp_id,
      verified_at = CASE WHEN p_status = 'verified' THEN now() ELSE NULL END,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
      updated_at = now()
  WHERE id = p_document_id;

  -- Update any matching onboarding task linked to this document
  UPDATE public.employee_onboarding_tasks
  SET status = CASE WHEN p_status = 'verified' THEN 'verified' ELSE 'rejected' END,
      rejection_notes = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
      completed_at = CASE WHEN p_status = 'verified' THEN now() ELSE completed_at END
  WHERE document_id = p_document_id;

  -- Recalculate progress for any affected onboarding
  PERFORM public.recalculate_onboarding_progress(onboarding_id)
  FROM public.employee_onboarding_tasks
  WHERE document_id = p_document_id;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', p_document_id,
    'status', p_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_employee_document(uuid, text, text) TO authenticated;

-- E. Transactional: Complete Employee Onboarding
CREATE OR REPLACE FUNCTION public.complete_employee_onboarding(
  p_onboarding_id uuid,
  p_hr_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_onb record;
  v_reviewer_emp_id uuid;
  v_current_year integer := EXTRACT(year FROM CURRENT_DATE)::integer;
BEGIN
  SELECT * INTO v_onb FROM public.employee_onboarding WHERE id = p_onboarding_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding record not found';
  END IF;

  SELECT id INTO v_reviewer_emp_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;

  -- 1. Complete onboarding
  UPDATE public.employee_onboarding
  SET status = 'completed',
      progress_percentage = 100,
      completed_at = now(),
      hr_reviewer_id = v_reviewer_emp_id,
      hr_notes = COALESCE(p_hr_notes, hr_notes),
      updated_at = now()
  WHERE id = p_onboarding_id;

  -- 2. Mark remaining tasks verified/completed
  UPDATE public.employee_onboarding_tasks
  SET status = 'completed',
      completed_at = COALESCE(completed_at, now())
  WHERE onboarding_id = p_onboarding_id AND status != 'completed';

  -- 3. Update employee record to active & completed onboarding
  UPDATE public.employees
  SET status = 'active',
      onboarding_status = 'completed',
      bank_name = COALESCE(v_onb.bank_name, bank_name),
      bank_account_number = COALESCE(v_onb.bank_account_number, bank_account_number),
      bank_ifsc_code = COALESCE(v_onb.bank_ifsc_code, bank_ifsc_code),
      bank_branch = COALESCE(v_onb.bank_branch, bank_branch),
      bank_account_holder = COALESCE(v_onb.bank_account_holder, bank_account_holder),
      pan_number = COALESCE(v_onb.pan_number, pan_number),
      updated_at = now()
  WHERE id = v_onb.employee_id;

  -- 4. Auto-allocate annual leaves if not yet allocated
  BEGIN
    PERFORM public.allocate_annual_leaves(v_current_year, v_onb.employee_id, v_onb.organization_id);
  EXCEPTION WHEN OTHERS THEN
    -- Leave allocation non-fatal if leave types not yet initialized
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'onboarding_id', p_onboarding_id,
    'employee_id', v_onb.employee_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_employee_onboarding(uuid, text) TO authenticated;

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_onboarding_tasks ENABLE ROW LEVEL SECURITY;

-- Document Categories RLS
CREATE POLICY "document_categories_read_all" ON public.document_categories
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "document_categories_manage_admin" ON public.document_categories
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
  )
);

-- Onboarding Templates RLS
CREATE POLICY "onboarding_templates_read" ON public.onboarding_templates
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "onboarding_templates_manage_admin" ON public.onboarding_templates
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Onboarding Checklist Items RLS
CREATE POLICY "onboarding_checklist_items_read" ON public.onboarding_checklist_items
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "onboarding_checklist_items_manage_admin" ON public.onboarding_checklist_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Employee Onboarding RLS
CREATE POLICY "employee_onboarding_select" ON public.employee_onboarding
FOR SELECT TO authenticated
USING (
  -- Employee can see their own onboarding
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  OR
  -- Admins and managers can see all in org
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "employee_onboarding_update" ON public.employee_onboarding
FOR UPDATE TO authenticated
USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "employee_onboarding_insert" ON public.employee_onboarding
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
  )
);

-- Employee Onboarding Tasks RLS
CREATE POLICY "employee_onboarding_tasks_select" ON public.employee_onboarding_tasks
FOR SELECT TO authenticated
USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "employee_onboarding_tasks_update" ON public.employee_onboarding_tasks
FOR UPDATE TO authenticated
USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "employee_onboarding_tasks_insert" ON public.employee_onboarding_tasks
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
  )
);
