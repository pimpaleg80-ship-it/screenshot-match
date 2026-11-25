-- ============================================================================
-- 20261124170000_phase07_hr_helpdesk_and_expense_management.sql
-- FLOWPEOPLE PHASE 07: HR Helpdesk + Expense Management
-- Additive migration: schemas, tables, relationships, helper functions, and RLS policies.
-- ============================================================================

-- ============================================================================
-- 1. HR HELPDESK CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_ticket_categories_org ON public.hr_ticket_categories(organization_id);

-- Seed standard ticket categories if none exist
INSERT INTO public.hr_ticket_categories (name, description, organization_id)
SELECT 'Attendance complaints', 'Discrepancies in check-in, check-out, shifts, or biometric records', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.hr_ticket_categories WHERE name = 'Attendance complaints');

INSERT INTO public.hr_ticket_categories (name, description, organization_id)
SELECT 'Leave queries', 'Questions regarding leave balances, allocations, carry forwards or approvals', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.hr_ticket_categories WHERE name = 'Leave queries');

INSERT INTO public.hr_ticket_categories (name, description, organization_id)
SELECT 'Payroll queries', 'Inquiries concerning salary slips, deductions, bonuses, taxes, or bank updates', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.hr_ticket_categories WHERE name = 'Payroll queries');

INSERT INTO public.hr_ticket_categories (name, description, organization_id)
SELECT 'General HR requests', 'Company policies, letters, certificates, HR assistance, or workplace matters', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.hr_ticket_categories WHERE name = 'General HR requests');

INSERT INTO public.hr_ticket_categories (name, description, organization_id)
SELECT 'Benefits & Insurance', 'Health insurance, PF/ESI, corporate perks, and claim processing assistance', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.hr_ticket_categories WHERE name = 'Benefits & Insurance');

INSERT INTO public.hr_ticket_categories (name, description, organization_id)
SELECT 'Workplace & IT Support', 'Laptop, software access, email accounts, biometric enrollment or desk setup', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.hr_ticket_categories WHERE name = 'Workplace & IT Support');

-- ============================================================================
-- 2. EXTEND public.hr_tickets
-- ============================================================================
ALTER TABLE public.hr_tickets
ADD COLUMN IF NOT EXISTS assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS attachment_name text,
ADD COLUMN IF NOT EXISTS attachment_size integer,
ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS closed_at timestamptz,
ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hr_tickets_assigned_emp ON public.hr_tickets(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_tickets_priority ON public.hr_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_hr_tickets_created_at ON public.hr_tickets(created_at DESC);

-- ============================================================================
-- 3. HR TICKET COMMENTS & THREADS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.hr_tickets(id) ON DELETE CASCADE,
  organization_id uuid,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  author_name text,
  author_role text,
  message text NOT NULL,
  is_internal boolean DEFAULT false,
  attachment_url text,
  attachment_name text,
  attachment_size integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_ticket_comments_ticket ON public.hr_ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hr_ticket_comments_created ON public.hr_ticket_comments(created_at);

-- ============================================================================
-- 4. HR TICKET AUDIT HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.hr_tickets(id) ON DELETE CASCADE,
  organization_id uuid,
  changed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'created', 'assigned', 'status_changed', 'comment_added', 'resolved', 'closed'
  from_status text,
  to_status text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_ticket_history_ticket ON public.hr_ticket_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hr_ticket_history_created ON public.hr_ticket_history(created_at DESC);

-- ============================================================================
-- 5. EXPENSE CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_org ON public.expense_categories(organization_id);

-- Seed standard expense categories
INSERT INTO public.expense_categories (name, description, organization_id)
SELECT 'Travel expenses', 'Airfare, train tickets, bus fares, tolls, fuel and outstation travel costs', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE name = 'Travel expenses');

INSERT INTO public.expense_categories (name, description, organization_id)
SELECT 'Food expenses', 'Business meals, client dining, team lunch and working dinners', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE name = 'Food expenses');

INSERT INTO public.expense_categories (name, description, organization_id)
SELECT 'Accommodation', 'Hotel rooms, guest houses, and lodging during business trips', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE name = 'Accommodation');

INSERT INTO public.expense_categories (name, description, organization_id)
SELECT 'Transport', 'Local cab, taxi, metro, auto-rickshaw and daily work commuting reimbursements', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE name = 'Transport');

INSERT INTO public.expense_categories (name, description, organization_id)
SELECT 'Office Supplies', 'Stationery, printer accessories, work-from-home accessories and desk consumables', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE name = 'Office Supplies');

INSERT INTO public.expense_categories (name, description, organization_id)
SELECT 'Training & Certifications', 'Professional courses, webinars, conference tickets and exam vouchers', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE name = 'Training & Certifications');

INSERT INTO public.expense_categories (name, description, organization_id)
SELECT 'Client Entertainment', 'Authorized entertainment and gifts for business clients and partners', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE name = 'Client Entertainment');

INSERT INTO public.expense_categories (name, description, organization_id)
SELECT 'Other Reimbursable', 'Miscellaneous approved company business expenditures', (SELECT id FROM public.organizations LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE name = 'Other Reimbursable');

-- ============================================================================
-- 6. EXTEND public.expense_claims FOR MULTI-LEVEL APPROVAL & REIMBURSEMENT
-- ============================================================================
ALTER TABLE public.expense_claims
ADD COLUMN IF NOT EXISTS receipt_storage_path text,
ADD COLUMN IF NOT EXISTS receipt_name text,
ADD COLUMN IF NOT EXISTS receipt_size integer,
ADD COLUMN IF NOT EXISTS manager_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
ADD COLUMN IF NOT EXISTS manager_notes text,
ADD COLUMN IF NOT EXISTS finance_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS finance_approved_at timestamptz,
ADD COLUMN IF NOT EXISTS finance_notes text,
ADD COLUMN IF NOT EXISTS reimbursed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reimbursed_at timestamptz,
ADD COLUMN IF NOT EXISTS reimbursement_reference text,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Bank Transfer',
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS current_approval_level text DEFAULT 'manager'; -- 'manager', 'finance', 'completed'

CREATE INDEX IF NOT EXISTS idx_expense_claims_approval_level ON public.expense_claims(current_approval_level);
CREATE INDEX IF NOT EXISTS idx_expense_claims_expense_date ON public.expense_claims(expense_date DESC);

-- ============================================================================
-- 7. EXPENSE CLAIM AUDIT HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.expense_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expense_claims(id) ON DELETE CASCADE,
  organization_id uuid,
  changed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'submitted', 'manager_approved', 'manager_rejected', 'finance_approved', 'finance_rejected', 'reimbursed'
  from_status text,
  to_status text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_history_expense ON public.expense_history(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_history_created ON public.expense_history(created_at DESC);

-- ============================================================================
-- 8. PRIVATE STORAGE BUCKETS CONFIGURATION
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('helpdesk-attachments', 'helpdesk-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ============================================================================
-- 9. TRANSACTIONAL FUNCTIONS & RPCS
-- ============================================================================

-- A. Create HR Support Ticket
CREATE OR REPLACE FUNCTION public.create_hr_ticket(
  p_subject text,
  p_category text,
  p_priority text,
  p_description text,
  p_employee_id uuid DEFAULT NULL,
  p_attachment_url text DEFAULT NULL,
  p_attachment_name text DEFAULT NULL,
  p_attachment_size integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_emp_id uuid;
  v_org_id uuid;
  v_ticket_id uuid;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_employee_id IS NOT NULL THEN
    v_emp_id := p_employee_id;
  ELSE
    SELECT id, organization_id INTO v_emp_id, v_org_id
    FROM public.employees
    WHERE user_id = v_caller_uid
    LIMIT 1;
  END IF;

  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'Employee profile not found';
  END IF;

  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.employees
    WHERE id = v_emp_id;
  END IF;

  INSERT INTO public.hr_tickets (
    employee_id,
    organization_id,
    subject,
    category,
    priority,
    description,
    status,
    attachment_url,
    attachment_name,
    attachment_size
  ) VALUES (
    v_emp_id,
    v_org_id,
    TRIM(p_subject),
    COALESCE(NULLIF(TRIM(p_category), ''), 'General HR requests'),
    COALESCE(NULLIF(TRIM(p_priority), ''), 'medium'),
    TRIM(p_description),
    'open',
    p_attachment_url,
    p_attachment_name,
    p_attachment_size
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.hr_ticket_history (
    ticket_id,
    organization_id,
    changed_by_user_id,
    action,
    from_status,
    to_status,
    notes
  ) VALUES (
    v_ticket_id,
    v_org_id,
    v_caller_uid,
    'created',
    NULL,
    'open',
    'Ticket created by employee'
  );

  RETURN v_ticket_id;
END;
$$;

-- B. Update HR Ticket Status & Assignment
CREATE OR REPLACE FUNCTION public.update_hr_ticket_status(
  p_ticket_id uuid,
  p_status text,
  p_assigned_to uuid DEFAULT NULL,
  p_assigned_employee_id uuid DEFAULT NULL,
  p_resolution_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_ticket RECORD;
  v_old_status text;
  v_old_assigned uuid;
  v_action text := 'status_changed';
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Lock row FOR UPDATE to prevent race conditions
  SELECT * INTO v_ticket
  FROM public.hr_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  v_old_status := v_ticket.status;
  v_old_assigned := v_ticket.assigned_to;

  -- Check permissions: Admin, Manager, Superadmin, or Reporter closing a resolved ticket
  IF NOT (
    public.has_role(v_caller_uid, 'admin') OR
    public.is_superadmin(v_caller_uid) OR
    public.has_role(v_caller_uid, 'manager') OR
    (p_status = 'closed' AND v_ticket.employee_id = (SELECT id FROM public.employees WHERE user_id = v_caller_uid LIMIT 1))
  ) THEN
    RAISE EXCEPTION 'Unauthorized to update ticket status';
  END IF;

  -- If status is changing to assigned and assignment is passed
  IF p_assigned_to IS NOT NULL AND (v_old_assigned IS NULL OR v_old_assigned <> p_assigned_to) THEN
    v_action := 'assigned';
  END IF;

  IF p_status = 'resolved' THEN
    v_action := 'resolved';
    UPDATE public.hr_tickets
    SET
      status = 'resolved',
      resolved_at = now(),
      resolved_by = v_caller_uid,
      resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
      assigned_to = COALESCE(p_assigned_to, assigned_to),
      assigned_employee_id = COALESCE(p_assigned_employee_id, assigned_employee_id),
      updated_at = now()
    WHERE id = p_ticket_id;
  ELSIF p_status = 'closed' THEN
    v_action := 'closed';
    UPDATE public.hr_tickets
    SET
      status = 'closed',
      closed_at = now(),
      closed_by = v_caller_uid,
      updated_at = now()
    WHERE id = p_ticket_id;
  ELSE
    UPDATE public.hr_tickets
    SET
      status = p_status,
      assigned_to = COALESCE(p_assigned_to, assigned_to),
      assigned_employee_id = COALESCE(p_assigned_employee_id, assigned_employee_id),
      resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
      updated_at = now()
    WHERE id = p_ticket_id;
  END IF;

  INSERT INTO public.hr_ticket_history (
    ticket_id,
    organization_id,
    changed_by_user_id,
    action,
    from_status,
    to_status,
    notes
  ) VALUES (
    p_ticket_id,
    v_ticket.organization_id,
    v_caller_uid,
    v_action,
    v_old_status,
    p_status,
    COALESCE(p_resolution_notes, 'Status transitioned from ' || v_old_status || ' to ' || p_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'previous_status', v_old_status,
    'status', p_status
  );
END;
$$;

-- C. Add HR Ticket Comment / Message
CREATE OR REPLACE FUNCTION public.add_hr_ticket_comment(
  p_ticket_id uuid,
  p_message text,
  p_is_internal boolean DEFAULT false,
  p_attachment_url text DEFAULT NULL,
  p_attachment_name text DEFAULT NULL,
  p_attachment_size integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_ticket RECORD;
  v_emp RECORD;
  v_comment_id uuid;
  v_author_role text := 'Employee';
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_ticket
  FROM public.hr_tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- Get author details
  SELECT * INTO v_emp
  FROM public.employees
  WHERE user_id = v_caller_uid
  LIMIT 1;

  IF public.is_superadmin(v_caller_uid) THEN
    v_author_role := 'Superadmin';
  ELSIF public.has_role(v_caller_uid, 'admin') THEN
    v_author_role := 'HR Admin';
  ELSIF public.has_role(v_caller_uid, 'manager') THEN
    v_author_role := 'Manager';
  ELSE
    v_author_role := 'Employee';
  END IF;

  -- Employees cannot make internal notes
  IF p_is_internal AND v_author_role = 'Employee' THEN
    RAISE EXCEPTION 'Only HR and Managers can post internal notes';
  END IF;

  INSERT INTO public.hr_ticket_comments (
    ticket_id,
    organization_id,
    author_user_id,
    author_employee_id,
    author_name,
    author_role,
    message,
    is_internal,
    attachment_url,
    attachment_name,
    attachment_size
  ) VALUES (
    p_ticket_id,
    v_ticket.organization_id,
    v_caller_uid,
    v_emp.id,
    COALESCE(v_emp.full_name, 'Staff Member'),
    v_author_role,
    TRIM(p_message),
    p_is_internal,
    p_attachment_url,
    p_attachment_name,
    p_attachment_size
  )
  RETURNING id INTO v_comment_id;

  INSERT INTO public.hr_ticket_history (
    ticket_id,
    organization_id,
    changed_by_user_id,
    action,
    from_status,
    to_status,
    notes
  ) VALUES (
    p_ticket_id,
    v_ticket.organization_id,
    v_caller_uid,
    'comment_added',
    v_ticket.status,
    v_ticket.status,
    CASE WHEN p_is_internal THEN 'Internal note posted' ELSE 'Reply posted by ' || v_author_role END
  );

  -- If ticket was resolved and employee replies, reopen to in_progress
  IF v_ticket.status = 'resolved' AND NOT p_is_internal AND v_emp.id = v_ticket.employee_id THEN
    UPDATE public.hr_tickets
    SET status = 'in_progress', updated_at = now()
    WHERE id = p_ticket_id;

    INSERT INTO public.hr_ticket_history (
      ticket_id,
      organization_id,
      changed_by_user_id,
      action,
      from_status,
      to_status,
      notes
    ) VALUES (
      p_ticket_id,
      v_ticket.organization_id,
      v_caller_uid,
      'status_changed',
      'resolved',
      'in_progress',
      'Ticket automatically reopened following employee reply'
    );
  END IF;

  RETURN v_comment_id;
END;
$$;

-- D. Submit Expense Claim
CREATE OR REPLACE FUNCTION public.submit_expense_claim(
  p_title text,
  p_category text,
  p_amount numeric,
  p_expense_date date,
  p_notes text DEFAULT NULL,
  p_receipt_url text DEFAULT NULL,
  p_receipt_storage_path text DEFAULT NULL,
  p_receipt_name text DEFAULT NULL,
  p_receipt_size integer DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_emp_id uuid;
  v_org_id uuid;
  v_claim_id uuid;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;

  IF p_employee_id IS NOT NULL THEN
    v_emp_id := p_employee_id;
  ELSE
    SELECT id, organization_id INTO v_emp_id, v_org_id
    FROM public.employees
    WHERE user_id = v_caller_uid
    LIMIT 1;
  END IF;

  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'Employee profile not found';
  END IF;

  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.employees
    WHERE id = v_emp_id;
  END IF;

  INSERT INTO public.expense_claims (
    employee_id,
    organization_id,
    title,
    category,
    amount,
    currency,
    expense_date,
    notes,
    receipt_url,
    receipt_storage_path,
    receipt_name,
    receipt_size,
    status,
    current_approval_level
  ) VALUES (
    v_emp_id,
    v_org_id,
    TRIM(p_title),
    COALESCE(NULLIF(TRIM(p_category), ''), 'General'),
    p_amount,
    'INR',
    COALESCE(p_expense_date, CURRENT_DATE),
    p_notes,
    p_receipt_url,
    p_receipt_storage_path,
    p_receipt_name,
    p_receipt_size,
    'pending',
    'manager'
  )
  RETURNING id INTO v_claim_id;

  INSERT INTO public.expense_history (
    expense_id,
    organization_id,
    changed_by_user_id,
    action,
    from_status,
    to_status,
    notes
  ) VALUES (
    v_claim_id,
    v_org_id,
    v_caller_uid,
    'submitted',
    NULL,
    'pending',
    'Expense submitted for manager review'
  );

  RETURN v_claim_id;
END;
$$;

-- E. Approve Expense Claim (Transactional with row-lock)
CREATE OR REPLACE FUNCTION public.approve_expense_claim(
  p_claim_id uuid,
  p_level text, -- 'manager' or 'finance'
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_claim RECORD;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Concurrency control: Lock the row FOR UPDATE
  SELECT * INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense claim not found';
  END IF;

  IF p_level = 'manager' THEN
    -- Verify current status is pending
    IF v_claim.status <> 'pending' THEN
      RAISE EXCEPTION 'Claim cannot be approved at Manager stage: current status is %', v_claim.status;
    END IF;

    -- Verify caller is manager, admin or superadmin
    IF NOT (
      public.has_role(v_caller_uid, 'admin') OR
      public.is_superadmin(v_caller_uid) OR
      public.has_role(v_caller_uid, 'manager')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: only Managers or HR Admins can approve at this stage';
    END IF;

    UPDATE public.expense_claims
    SET
      status = 'pending_finance',
      current_approval_level = 'finance',
      manager_approved_by = v_caller_uid,
      manager_approved_at = now(),
      manager_notes = p_notes,
      updated_at = now()
    WHERE id = p_claim_id;

    INSERT INTO public.expense_history (
      expense_id,
      organization_id,
      changed_by_user_id,
      action,
      from_status,
      to_status,
      notes
    ) VALUES (
      p_claim_id,
      v_claim.organization_id,
      v_caller_uid,
      'manager_approved',
      'pending',
      'pending_finance',
      COALESCE(p_notes, 'Approved by manager and routed to Finance/HR')
    );

    RETURN jsonb_build_object(
      'success', true,
      'claim_id', p_claim_id,
      'status', 'pending_finance',
      'current_approval_level', 'finance'
    );

  ELSIF p_level = 'finance' THEN
    -- Verify current status is pending_finance
    IF v_claim.status <> 'pending_finance' THEN
      RAISE EXCEPTION 'Claim cannot be approved at Finance stage: current status is %', v_claim.status;
    END IF;

    -- Verify caller is admin or superadmin
    IF NOT (
      public.has_role(v_caller_uid, 'admin') OR
      public.is_superadmin(v_caller_uid)
    ) THEN
      RAISE EXCEPTION 'Unauthorized: only HR or Finance Admins can approve at the final stage';
    END IF;

    UPDATE public.expense_claims
    SET
      status = 'approved',
      current_approval_level = 'completed',
      finance_approved_by = v_caller_uid,
      finance_approved_at = now(),
      finance_notes = p_notes,
      approved_by = v_caller_uid,
      updated_at = now()
    WHERE id = p_claim_id;

    INSERT INTO public.expense_history (
      expense_id,
      organization_id,
      changed_by_user_id,
      action,
      from_status,
      to_status,
      notes
    ) VALUES (
      p_claim_id,
      v_claim.organization_id,
      v_caller_uid,
      'finance_approved',
      'pending_finance',
      'approved',
      COALESCE(p_notes, 'Approved by Finance/HR. Ready for reimbursement disbursement.')
    );

    RETURN jsonb_build_object(
      'success', true,
      'claim_id', p_claim_id,
      'status', 'approved',
      'current_approval_level', 'completed'
    );

  ELSE
    RAISE EXCEPTION 'Invalid approval level: must be "manager" or "finance"';
  END IF;
END;
$$;

-- F. Reject Expense Claim (Transactional with row-lock)
CREATE OR REPLACE FUNCTION public.reject_expense_claim(
  p_claim_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_claim RECORD;
  v_old_status text;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Lock row FOR UPDATE
  SELECT * INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense claim not found';
  END IF;

  IF v_claim.status = 'rejected' THEN
    RAISE EXCEPTION 'Claim is already rejected';
  END IF;

  IF v_claim.status = 'reimbursed' THEN
    RAISE EXCEPTION 'Cannot reject an already reimbursed claim';
  END IF;

  IF NOT (
    public.has_role(v_caller_uid, 'admin') OR
    public.is_superadmin(v_caller_uid) OR
    public.has_role(v_caller_uid, 'manager')
  ) THEN
    RAISE EXCEPTION 'Unauthorized to reject expense claims';
  END IF;

  v_old_status := v_claim.status;

  UPDATE public.expense_claims
  SET
    status = 'rejected',
    current_approval_level = 'completed',
    rejected_by = v_caller_uid,
    rejected_at = now(),
    rejection_reason = TRIM(p_reason),
    updated_at = now()
  WHERE id = p_claim_id;

  INSERT INTO public.expense_history (
    expense_id,
    organization_id,
    changed_by_user_id,
    action,
    from_status,
    to_status,
    notes
  ) VALUES (
    p_claim_id,
    v_claim.organization_id,
    v_caller_uid,
    'rejected',
    v_old_status,
    'rejected',
    TRIM(p_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'claim_id', p_claim_id,
    'status', 'rejected'
  );
END;
$$;

-- G. Mark Expense Reimbursed (Transactional with row-lock)
CREATE OR REPLACE FUNCTION public.mark_expense_reimbursed(
  p_claim_id uuid,
  p_reference text DEFAULT NULL,
  p_payment_method text DEFAULT 'Bank Transfer',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_claim RECORD;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Lock row FOR UPDATE
  SELECT * INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense claim not found';
  END IF;

  IF v_claim.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved expense claims can be marked as reimbursed (current status: %)', v_claim.status;
  END IF;

  IF NOT (
    public.has_role(v_caller_uid, 'admin') OR
    public.is_superadmin(v_caller_uid)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only HR or Finance Admins can disburse reimbursements';
  END IF;

  UPDATE public.expense_claims
  SET
    status = 'reimbursed',
    reimbursed_by = v_caller_uid,
    reimbursed_at = now(),
    reimbursement_reference = TRIM(p_reference),
    payment_method = COALESCE(NULLIF(TRIM(p_payment_method), ''), 'Bank Transfer'),
    updated_at = now()
  WHERE id = p_claim_id;

  INSERT INTO public.expense_history (
    expense_id,
    organization_id,
    changed_by_user_id,
    action,
    from_status,
    to_status,
    notes
  ) VALUES (
    p_claim_id,
    v_claim.organization_id,
    v_caller_uid,
    'reimbursed',
    'approved',
    'reimbursed',
    COALESCE(p_notes, 'Reimbursement disbursed via ' || COALESCE(p_payment_method, 'Bank Transfer') || CASE WHEN p_reference IS NOT NULL THEN ' (Ref: ' || p_reference || ')' ELSE '' END)
  );

  RETURN jsonb_build_object(
    'success', true,
    'claim_id', p_claim_id,
    'status', 'reimbursed'
  );
END;
$$;

-- ============================================================================
-- 10. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- HR Ticket Categories RLS
ALTER TABLE public.hr_ticket_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_ticket_categories_select" ON public.hr_ticket_categories;
CREATE POLICY "hr_ticket_categories_select" ON public.hr_ticket_categories
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "hr_ticket_categories_admin_all" ON public.hr_ticket_categories;
CREATE POLICY "hr_ticket_categories_admin_all" ON public.hr_ticket_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- HR Ticket Comments RLS
ALTER TABLE public.hr_ticket_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_ticket_comments_select" ON public.hr_ticket_comments;
CREATE POLICY "hr_ticket_comments_select" ON public.hr_ticket_comments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.is_superadmin(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    (
      -- Employee can only see non-internal comments on their own tickets
      is_internal = false AND
      ticket_id IN (
        SELECT id FROM public.hr_tickets 
        WHERE employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );

DROP POLICY IF EXISTS "hr_ticket_comments_insert" ON public.hr_ticket_comments;
CREATE POLICY "hr_ticket_comments_insert" ON public.hr_ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.is_superadmin(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    (
      ticket_id IN (
        SELECT id FROM public.hr_tickets 
        WHERE employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );

-- HR Ticket History RLS
ALTER TABLE public.hr_ticket_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_ticket_history_select" ON public.hr_ticket_history;
CREATE POLICY "hr_ticket_history_select" ON public.hr_ticket_history
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.is_superadmin(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    (
      ticket_id IN (
        SELECT id FROM public.hr_tickets 
        WHERE employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );

-- Expense Categories RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_select" ON public.expense_categories;
CREATE POLICY "expense_categories_select" ON public.expense_categories
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "expense_categories_admin_all" ON public.expense_categories;
CREATE POLICY "expense_categories_admin_all" ON public.expense_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- Expense Claims History RLS
ALTER TABLE public.expense_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_history_select" ON public.expense_history;
CREATE POLICY "expense_history_select" ON public.expense_history
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.is_superadmin(auth.uid()) OR
    public.has_role(auth.uid(), 'manager') OR
    (
      expense_id IN (
        SELECT id FROM public.expense_claims 
        WHERE employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );

-- Storage Policies for Private Buckets
DROP POLICY IF EXISTS "expense_receipts_read" ON storage.objects;
CREATE POLICY "expense_receipts_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "expense_receipts_write" ON storage.objects;
CREATE POLICY "expense_receipts_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "helpdesk_attachments_read" ON storage.objects;
CREATE POLICY "helpdesk_attachments_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'helpdesk-attachments');

DROP POLICY IF EXISTS "helpdesk_attachments_write" ON storage.objects;
CREATE POLICY "helpdesk_attachments_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'helpdesk-attachments');

-- Grant RPC functions to authenticated
GRANT EXECUTE ON FUNCTION public.create_hr_ticket(text, text, text, text, uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_hr_ticket_status(uuid, text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_hr_ticket_comment(uuid, text, boolean, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_expense_claim(text, text, numeric, date, text, text, text, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_expense_claim(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_expense_claim(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_expense_reimbursed(uuid, text, text, text) TO authenticated;
