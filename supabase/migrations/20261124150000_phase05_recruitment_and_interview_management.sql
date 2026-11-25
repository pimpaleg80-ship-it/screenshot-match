-- ============================================================================
-- FLOWPEOPLE — PHASE 05: RECRUITMENT & INTERVIEW MANAGEMENT MIGRATION
-- ============================================================================

-- 1. JOB OPENINGS TABLE
CREATE TABLE IF NOT EXISTS public.job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  title text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  experience_level text DEFAULT 'mid', -- entry, mid, senior, lead, executive
  employment_type text DEFAULT 'full_time', -- full_time, part_time, contract, internship
  workplace_type text DEFAULT 'onsite', -- onsite, hybrid, remote
  location text,
  min_salary numeric,
  max_salary numeric,
  currency text DEFAULT 'INR',
  openings_count integer DEFAULT 1,
  status text NOT NULL DEFAULT 'published', -- draft, published, closed, on_hold
  hiring_manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_openings_org ON public.job_openings(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_openings_status ON public.job_openings(status);
CREATE INDEX IF NOT EXISTS idx_job_openings_dept ON public.job_openings(department_id);

-- 2. CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  job_opening_id uuid REFERENCES public.job_openings(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  current_company text,
  current_designation text,
  years_of_experience numeric DEFAULT 0,
  current_salary numeric,
  expected_salary numeric,
  notice_period_days integer DEFAULT 30,
  resume_url text,
  resume_file_name text,
  portfolio_url text,
  linkedin_url text,
  source text DEFAULT 'direct', -- direct, linkedin, referral, career_page, agency, other
  stage text NOT NULL DEFAULT 'applied', -- applied, screening, shortlisted, interview, selected, offer, hired, rejected
  rejection_reason text, -- skills_mismatch, salary_expectation, culture_fit, candidate_declined, duplicate, other
  rejection_notes text,
  offer_salary numeric,
  offer_status text NOT NULL DEFAULT 'not_offered', -- not_offered, offered, accepted, declined
  offer_date date,
  offer_accepted_date date,
  joining_date date,
  rating integer DEFAULT 0, -- 0-5
  notes text,
  converted_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidates_org ON public.candidates(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidates_job ON public.candidates(job_opening_id);
CREATE INDEX IF NOT EXISTS idx_candidates_stage ON public.candidates(stage);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON public.candidates(email);

-- 3. CANDIDATE INTERVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.candidate_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_opening_id uuid REFERENCES public.job_openings(id) ON DELETE CASCADE,
  interviewer_id uuid NOT NULL REFERENCES public.employees(id),
  round_name text NOT NULL, -- Screening Round, Technical Round 1, System Design, HR / Cultural Fit, Final Exec
  round_number integer DEFAULT 1,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 45,
  meeting_link text,
  location text,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
  rating integer, -- 1 to 5
  recommendation text, -- strong_hire, hire, hold, reject
  strengths text,
  weaknesses text,
  feedback text,
  feedback_submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_interviews_org ON public.candidate_interviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidate_interviews_candidate ON public.candidate_interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_interviews_interviewer ON public.candidate_interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_candidate_interviews_scheduled_at ON public.candidate_interviews(scheduled_at);

-- 4. CANDIDATE ACTIVITIES (AUDIT TRAIL & HIRING TIMELINE)
CREATE TABLE IF NOT EXISTS public.candidate_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, -- stage_change, interview_scheduled, feedback_submitted, offer_extended, offer_accepted, rejected, converted_to_employee, note_added
  from_stage text,
  to_stage text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_activities_candidate ON public.candidate_activities(candidate_id);

-- 5. CANDIDATE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.candidate_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  file_size integer,
  category text DEFAULT 'resume',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_documents_candidate ON public.candidate_documents(candidate_id);

-- 6. PRIVATE STORAGE BUCKET FOR RESUMES & CANDIDATE ATTACHMENTS
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 7. HELPER PROCEDURES & ATOMIC FUNCTIONS

-- Advance or change candidate stage
CREATE OR REPLACE FUNCTION public.advance_candidate_stage(
  p_candidate_id uuid,
  p_new_stage text,
  p_notes text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_old_stage text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  SELECT stage INTO v_old_stage
  FROM public.candidates
  WHERE id = p_candidate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found: %', p_candidate_id;
  END IF;

  UPDATE public.candidates
  SET
    stage = p_new_stage,
    rejection_reason = CASE WHEN p_new_stage = 'rejected' THEN p_rejection_reason ELSE rejection_reason END,
    rejection_notes = CASE WHEN p_new_stage = 'rejected' THEN p_notes ELSE rejection_notes END,
    updated_at = now()
  WHERE id = p_candidate_id;

  INSERT INTO public.candidate_activities (
    candidate_id,
    performed_by,
    action,
    from_stage,
    to_stage,
    notes
  ) VALUES (
    p_candidate_id,
    v_user_id,
    CASE WHEN p_new_stage = 'rejected' THEN 'rejected' ELSE 'stage_change' END,
    v_old_stage,
    p_new_stage,
    COALESCE(p_notes, 'Stage changed from ' || v_old_stage || ' to ' || p_new_stage)
  );

  RETURN true;
END;
$$;

-- Submit interview feedback
CREATE OR REPLACE FUNCTION public.submit_interview_feedback(
  p_interview_id uuid,
  p_rating integer,
  p_recommendation text,
  p_strengths text DEFAULT NULL,
  p_weaknesses text DEFAULT NULL,
  p_feedback text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_candidate_id uuid;
  v_avg_rating integer;
  v_user_id uuid;
  v_round_name text;
BEGIN
  v_user_id := auth.uid();

  SELECT candidate_id, round_name INTO v_candidate_id, v_round_name
  FROM public.candidate_interviews
  WHERE id = p_interview_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interview record not found: %', p_interview_id;
  END IF;

  UPDATE public.candidate_interviews
  SET
    rating = p_rating,
    recommendation = p_recommendation,
    strengths = p_strengths,
    weaknesses = p_weaknesses,
    feedback = p_feedback,
    status = 'completed',
    feedback_submitted_at = now(),
    updated_at = now()
  WHERE id = p_interview_id;

  -- Calculate candidate average rating across all completed interviews
  SELECT COALESCE(ROUND(AVG(rating)), p_rating)
  INTO v_avg_rating
  FROM public.candidate_interviews
  WHERE candidate_id = v_candidate_id AND rating IS NOT NULL;

  UPDATE public.candidates
  SET rating = v_avg_rating, updated_at = now()
  WHERE id = v_candidate_id;

  INSERT INTO public.candidate_activities (
    candidate_id,
    performed_by,
    action,
    notes
  ) VALUES (
    v_candidate_id,
    v_user_id,
    'feedback_submitted',
    'Submitted ' || p_recommendation || ' (' || p_rating || '/5) for ' || v_round_name
  );

  RETURN true;
END;
$$;

-- Atomic Candidate-to-Employee Conversion
CREATE OR REPLACE FUNCTION public.convert_candidate_to_employee(
  p_candidate_id uuid,
  p_employee_code text,
  p_joining_date date,
  p_designation text DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL,
  p_employment_type text DEFAULT 'full_time',
  p_shift_id uuid DEFAULT NULL,
  p_start_onboarding boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_cand record;
  v_existing_emp_id uuid;
  v_new_emp_id uuid;
  v_user_id uuid;
  v_org_id uuid;
  v_doc_record record;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_cand
  FROM public.candidates
  WHERE id = p_candidate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found: %', p_candidate_id;
  END IF;

  -- 1. Check if employee with same email already exists (prevent duplicate employee profiles!)
  SELECT id INTO v_existing_emp_id
  FROM public.employees
  WHERE LOWER(email) = LOWER(v_cand.email)
  LIMIT 1;

  IF v_existing_emp_id IS NOT NULL THEN
    v_new_emp_id := v_existing_emp_id;

    -- Update existing profile with new designation / department if provided
    UPDATE public.employees
    SET
      designation = COALESCE(p_designation, designation),
      department_id = COALESCE(p_department_id, department_id),
      manager_id = COALESCE(p_manager_id, manager_id),
      status = 'active',
      joining_date = COALESCE(p_joining_date, joining_date, CURRENT_DATE),
      employment_type = COALESCE(p_employment_type, employment_type),
      shift_id = COALESCE(p_shift_id, shift_id),
      updated_at = now()
    WHERE id = v_existing_emp_id;
  ELSE
    -- 2. Create new employee record
    v_org_id := v_cand.organization_id;

    INSERT INTO public.employees (
      organization_id,
      employee_code,
      full_name,
      email,
      phone,
      department_id,
      designation,
      manager_id,
      joining_date,
      employment_type,
      shift_id,
      status,
      onboarding_status
    ) VALUES (
      v_org_id,
      p_employee_code,
      v_cand.full_name,
      v_cand.email,
      v_cand.phone,
      p_department_id,
      COALESCE(p_designation, v_cand.current_designation, 'New Hire'),
      p_manager_id,
      COALESCE(p_joining_date, CURRENT_DATE),
      COALESCE(p_employment_type, 'full_time'),
      p_shift_id,
      'active',
      CASE WHEN p_start_onboarding THEN 'in_progress' ELSE 'completed' END
    )
    RETURNING id INTO v_new_emp_id;
  END IF;

  -- 3. Copy candidate resume and documents into public.documents
  IF v_cand.resume_url IS NOT NULL THEN
    INSERT INTO public.documents (
      organization_id,
      employee_id,
      title,
      category,
      document_type,
      file_url,
      file_name,
      verification_status,
      uploaded_by
    ) VALUES (
      v_cand.organization_id,
      v_new_emp_id,
      'Resume - ' || v_cand.full_name,
      'Personal Document',
      'Resume',
      v_cand.resume_url,
      v_cand.resume_file_name,
      'verified',
      v_user_id
    );
  END IF;

  -- Copy other attached candidate documents
  FOR v_doc_record IN
    SELECT * FROM public.candidate_documents WHERE candidate_id = p_candidate_id
  LOOP
    INSERT INTO public.documents (
      organization_id,
      employee_id,
      title,
      category,
      file_url,
      file_name,
      file_size,
      verification_status,
      uploaded_by
    ) VALUES (
      v_cand.organization_id,
      v_new_emp_id,
      v_doc_record.title,
      'Personal Document',
      v_doc_record.file_url,
      v_doc_record.file_name,
      v_doc_record.file_size,
      'verified',
      v_user_id
    );
  END LOOP;

  -- 4. Update candidate status to hired
  UPDATE public.candidates
  SET
    stage = 'hired',
    offer_status = 'accepted',
    converted_employee_id = v_new_emp_id,
    joining_date = COALESCE(p_joining_date, joining_date, CURRENT_DATE),
    updated_at = now()
  WHERE id = p_candidate_id;

  -- 5. If requested, initiate employee onboarding pipeline
  IF p_start_onboarding THEN
    PERFORM public.start_employee_onboarding(v_new_emp_id, NULL, (COALESCE(p_joining_date, CURRENT_DATE) + 14));
  END IF;

  -- 6. Allocate annual leaves
  PERFORM public.allocate_annual_leaves(v_new_emp_id, EXTRACT(YEAR FROM CURRENT_DATE)::integer);

  -- 7. Record activity
  INSERT INTO public.candidate_activities (
    candidate_id,
    performed_by,
    action,
    to_stage,
    notes
  ) VALUES (
    p_candidate_id,
    v_user_id,
    'converted_to_employee',
    'hired',
    'Candidate converted to employee roster (' || p_employee_code || ')'
  );

  RETURN v_new_emp_id;
END;
$$;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;

-- Job Openings Policies
CREATE POLICY "Users can view job openings in their organization"
ON public.job_openings FOR SELECT
USING (
  organization_id IS NULL OR
  organization_id = (SELECT organization_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

CREATE POLICY "HR and Admins can manage job openings"
ON public.job_openings FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid()) OR
  public.has_role(auth.uid(), 'manager')
);

-- Candidates Policies
CREATE POLICY "HR and Managers can view candidates"
ON public.candidates FOR SELECT
USING (
  organization_id IS NULL OR
  organization_id = (SELECT organization_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid()) OR
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "HR and Admins can manage candidates"
ON public.candidates FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- Interviews Policies
CREATE POLICY "Users can view interviews assigned to them or if HR/Admin"
ON public.candidate_interviews FOR SELECT
USING (
  interviewer_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid()) OR
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Interviewers and HR can update interviews"
ON public.candidate_interviews FOR ALL
USING (
  interviewer_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- Activities Policies
CREATE POLICY "HR and Managers can view candidate activities"
ON public.candidate_activities FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid()) OR
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Authenticated users can insert candidate activities"
ON public.candidate_activities FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Candidate Documents Policies
CREATE POLICY "HR and Managers can view candidate documents"
ON public.candidate_documents FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid()) OR
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "HR and Admins can manage candidate documents"
ON public.candidate_documents FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- 9. SEED SAMPLE JOB OPENINGS FOR QUICK START
DO $$
DECLARE
  v_dept_id uuid;
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments LIMIT 1;
  SELECT id INTO v_admin_id FROM public.employees WHERE is_superadmin = true OR user_id IS NOT NULL LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.job_openings LIMIT 1) THEN
    INSERT INTO public.job_openings (title, description, department_id, experience_level, employment_type, workplace_type, location, min_salary, max_salary, openings_count, status, hiring_manager_id)
    VALUES
      ('Lead Full Stack Engineer', 'Lead our core architecture, scale micro-frontends, and mentor a high-performing product engineering squad.', v_dept_id, 'lead', 'full_time', 'hybrid', 'Bengaluru, India', 2400000, 3600000, 2, 'published', v_admin_id),
      ('Product Designer (UI/UX)', 'Design intuitive enterprise workflows, design tokens, and delightful cross-platform mobile experiences.', v_dept_id, 'mid', 'full_time', 'remote', 'Remote', 1400000, 2200000, 1, 'published', v_admin_id),
      ('HR Talent Acquisition Specialist', 'Manage end-to-end recruitment pipelines, conduct cultural screenings, and champion employee onboarding.', v_dept_id, 'mid', 'full_time', 'onsite', 'Mumbai, India', 900000, 1500000, 1, 'published', v_admin_id);
  END IF;
END $$;
