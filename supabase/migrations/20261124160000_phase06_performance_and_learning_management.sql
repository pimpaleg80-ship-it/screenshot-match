-- ============================================================================
-- FLOWPEOPLE — PHASE 06: PERFORMANCE MANAGEMENT & LMS MIGRATION
-- ============================================================================

-- 1. PERFORMANCE CYCLES TABLE
CREATE TABLE IF NOT EXISTS public.performance_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  title text NOT NULL,
  cycle_type text NOT NULL DEFAULT 'annual', -- monthly, quarterly, annual
  start_date date NOT NULL,
  due_date date NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active', -- draft, active, evaluation, closed
  created_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perf_cycles_org ON public.performance_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_perf_cycles_status ON public.performance_cycles(status);

-- 2. PERFORMANCE GOALS & KPIS TABLE
CREATE TABLE IF NOT EXISTS public.performance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  cycle_id uuid REFERENCES public.performance_cycles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  goal_type text NOT NULL DEFAULT 'individual', -- individual, department, kpi
  metric text,
  target_value numeric,
  current_value numeric DEFAULT 0,
  unit text DEFAULT '%',
  weightage integer DEFAULT 10 CHECK (weightage >= 0 AND weightage <= 100),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status text NOT NULL DEFAULT 'in_progress', -- not_started, in_progress, achieved, exceeded, cancelled
  start_date date,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perf_goals_org ON public.performance_goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_perf_goals_emp ON public.performance_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_perf_goals_dept ON public.performance_goals(department_id);
CREATE INDEX IF NOT EXISTS idx_perf_goals_cycle ON public.performance_goals(cycle_id);
CREATE INDEX IF NOT EXISTS idx_perf_goals_status ON public.performance_goals(status);

-- 3. ENHANCE PERFORMANCE REVIEWS TABLE (Additive Migration)
ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.performance_cycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS self_rating numeric(3,1) CHECK (self_rating >= 1 AND self_rating <= 5),
  ADD COLUMN IF NOT EXISTS self_achievements text,
  ADD COLUMN IF NOT EXISTS self_growth_areas text,
  ADD COLUMN IF NOT EXISTS self_comments text,
  ADD COLUMN IF NOT EXISTS self_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_rating numeric(3,1) CHECK (manager_rating >= 1 AND manager_rating <= 5),
  ADD COLUMN IF NOT EXISTS manager_feedback text,
  ADD COLUMN IF NOT EXISTS manager_strengths text,
  ADD COLUMN IF NOT EXISTS manager_development_plan text,
  ADD COLUMN IF NOT EXISTS manager_recommendation text, -- exceeds_expectations, meets_expectations, needs_improvement, unsatisfactory
  ADD COLUMN IF NOT EXISTS manager_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_score numeric(3,1) CHECK (final_score >= 1 AND final_score <= 5),
  ADD COLUMN IF NOT EXISTS final_grade text, -- Outstanding, Exceeds, Meets, Needs Improvement
  ADD COLUMN IF NOT EXISTS hr_comments text,
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'self_review', -- self_review, manager_review, hr_calibration, completed
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_perf_reviews_cycle ON public.performance_reviews(cycle_id);
CREATE INDEX IF NOT EXISTS idx_perf_reviews_stage ON public.performance_reviews(stage);

-- 4. 360 PEER FEEDBACKS TABLE
CREATE TABLE IF NOT EXISTS public.performance_peer_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  review_id uuid REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  peer_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  relationship text DEFAULT 'peer', -- peer, cross_functional, junior, senior
  rating integer CHECK (rating >= 1 AND rating <= 5),
  strengths text,
  areas_for_improvement text,
  comments text,
  is_anonymous boolean DEFAULT false,
  status text NOT NULL DEFAULT 'requested', -- requested, submitted, declined
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peer_feedbacks_emp ON public.performance_peer_feedbacks(employee_id);
CREATE INDEX IF NOT EXISTS idx_peer_feedbacks_peer ON public.performance_peer_feedbacks(peer_id);
CREATE INDEX IF NOT EXISTS idx_peer_feedbacks_review ON public.performance_peer_feedbacks(review_id);

-- 5. LMS COURSES TABLE
CREATE TABLE IF NOT EXISTS public.lms_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'General',
  level text NOT NULL DEFAULT 'beginner', -- beginner, intermediate, advanced, all_levels
  estimated_duration_minutes integer DEFAULT 60,
  thumbnail_url text,
  status text NOT NULL DEFAULT 'published', -- draft, published, archived
  passing_score_percent integer DEFAULT 70 CHECK (passing_score_percent >= 0 AND passing_score_percent <= 100),
  created_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_courses_org ON public.lms_courses(organization_id);
CREATE INDEX IF NOT EXISTS idx_lms_courses_status ON public.lms_courses(status);
CREATE INDEX IF NOT EXISTS idx_lms_courses_category ON public.lms_courses(category);

-- 6. LMS LESSON MODULES TABLE
CREATE TABLE IF NOT EXISTS public.lms_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sequence_order integer NOT NULL DEFAULT 1,
  content_type text NOT NULL DEFAULT 'document', -- video, document, article, quiz
  content_url text,
  file_path text,
  text_content text,
  duration_minutes integer DEFAULT 15,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_modules_course ON public.lms_modules(course_id, sequence_order);

-- 7. LMS COURSE ENROLLMENTS TABLE
CREATE TABLE IF NOT EXISTS public.lms_course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  due_date date,
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  status text NOT NULL DEFAULT 'enrolled', -- enrolled, in_progress, completed, overdue
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  certificate_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(course_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_lms_enroll_emp ON public.lms_course_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_lms_enroll_course ON public.lms_course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_enroll_status ON public.lms_course_enrollments(status);

-- 8. LMS LESSON PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.lms_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  enrollment_id uuid NOT NULL REFERENCES public.lms_course_enrollments(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(enrollment_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_lms_progress_enroll ON public.lms_lesson_progress(enrollment_id);

-- 9. LMS QUIZZES TABLE
CREATE TABLE IF NOT EXISTS public.lms_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  passing_score_percent integer DEFAULT 70,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_quizzes_course ON public.lms_quizzes(course_id);

-- 10. LMS QUIZ QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.lms_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL, -- e.g. ["Option A", "Option B", "Option C"]
  correct_option_index integer NOT NULL,
  explanation text,
  order_index integer DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_lms_questions_quiz ON public.lms_quiz_questions(quiz_id, order_index);

-- 11. LMS QUIZ ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.lms_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  quiz_id uuid NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.lms_course_enrollments(id) ON DELETE CASCADE,
  score_percent integer NOT NULL,
  passed boolean NOT NULL,
  total_questions integer NOT NULL,
  correct_answers integer NOT NULL,
  answers jsonb,
  submitted_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_attempts_emp ON public.lms_quiz_attempts(employee_id);
CREATE INDEX IF NOT EXISTS idx_lms_attempts_quiz ON public.lms_quiz_attempts(quiz_id);

-- 12. LMS CERTIFICATES TABLE
CREATE TABLE IF NOT EXISTS public.lms_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  certificate_code text NOT NULL UNIQUE,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.lms_course_enrollments(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  final_score_percent integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_certs_emp ON public.lms_certificates(employee_id);
CREATE INDEX IF NOT EXISTS idx_lms_certs_code ON public.lms_certificates(certificate_code);

-- 13. PRIVATE STORAGE BUCKET FOR LEARNING MATERIALS
INSERT INTO storage.buckets (id, name, public)
VALUES ('learning-materials', 'learning-materials', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Authenticated users can read learning materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'learning-materials');

CREATE POLICY "HR and Managers can upload learning materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'learning-materials');

CREATE POLICY "HR and Managers can update learning materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'learning-materials');

-- 14. STORED PROCEDURES / RPC FUNCTIONS

-- A. Submit Self-Assessment
CREATE OR REPLACE FUNCTION public.submit_self_assessment(
  p_review_id uuid,
  p_self_rating numeric,
  p_self_achievements text,
  p_self_growth_areas text,
  p_self_comments text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_emp_id uuid;
  v_review_emp_id uuid;
BEGIN
  SELECT id INTO v_emp_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
  SELECT employee_id INTO v_review_emp_id FROM public.performance_reviews WHERE id = p_review_id;

  -- Ensure employee is only updating their own review
  IF v_emp_id IS NOT NULL AND v_review_emp_id IS NOT NULL AND v_emp_id <> v_review_emp_id THEN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())) THEN
      RAISE EXCEPTION 'Unauthorized: You can only submit self-assessment for your own performance review';
    END IF;
  END IF;

  UPDATE public.performance_reviews
  SET
    self_rating = p_self_rating,
    self_achievements = p_self_achievements,
    self_growth_areas = p_self_growth_areas,
    self_comments = p_self_comments,
    self_submitted_at = now(),
    stage = 'manager_review',
    updated_at = now()
  WHERE id = p_review_id;

  RETURN true;
END;
$$;

-- B. Submit Manager Assessment
CREATE OR REPLACE FUNCTION public.submit_manager_assessment(
  p_review_id uuid,
  p_manager_rating numeric,
  p_manager_feedback text,
  p_manager_strengths text,
  p_manager_development_plan text,
  p_manager_recommendation text,
  p_final_score numeric DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_self_rating numeric;
  v_calculated_final numeric;
  v_grade text;
BEGIN
  SELECT self_rating INTO v_self_rating FROM public.performance_reviews WHERE id = p_review_id;

  -- Calculate weighted final score (60% manager, 40% self, or manager if no self)
  IF p_final_score IS NOT NULL THEN
    v_calculated_final := p_final_score;
  ELSIF v_self_rating IS NOT NULL THEN
    v_calculated_final := ROUND((p_manager_rating * 0.6 + v_self_rating * 0.4)::numeric, 1);
  ELSE
    v_calculated_final := p_manager_rating;
  END IF;

  -- Assign performance grade
  IF v_calculated_final >= 4.5 THEN
    v_grade := 'Outstanding';
  ELSIF v_calculated_final >= 3.8 THEN
    v_grade := 'Exceeds Expectations';
  ELSIF v_calculated_final >= 2.8 THEN
    v_grade := 'Meets Expectations';
  ELSE
    v_grade := 'Needs Improvement';
  END IF;

  UPDATE public.performance_reviews
  SET
    reviewer_id = COALESCE(reviewer_id, (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)),
    manager_rating = p_manager_rating,
    manager_feedback = p_manager_feedback,
    manager_strengths = p_manager_strengths,
    manager_development_plan = p_manager_development_plan,
    manager_recommendation = p_manager_recommendation,
    manager_submitted_at = now(),
    final_score = v_calculated_final,
    final_grade = v_grade,
    rating = ROUND(v_calculated_final)::integer,
    stage = 'completed',
    status = 'completed',
    updated_at = now()
  WHERE id = p_review_id;

  RETURN true;
END;
$$;

-- C. Update Goal Progress
CREATE OR REPLACE FUNCTION public.update_goal_progress(
  p_goal_id uuid,
  p_progress integer,
  p_current_value numeric DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_new_status text;
BEGIN
  IF p_status IS NOT NULL THEN
    v_new_status := p_status;
  ELSIF p_progress >= 100 THEN
    v_new_status := 'achieved';
  ELSIF p_progress > 0 THEN
    v_new_status := 'in_progress';
  ELSE
    v_new_status := 'not_started';
  END IF;

  UPDATE public.performance_goals
  SET
    progress = LEAST(100, GREATEST(0, p_progress)),
    current_value = COALESCE(p_current_value, current_value),
    status = v_new_status,
    updated_at = now()
  WHERE id = p_goal_id;

  RETURN true;
END;
$$;

-- D. Complete LMS Lesson Module
CREATE OR REPLACE FUNCTION public.complete_lesson_module(
  p_enrollment_id uuid,
  p_module_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_enrollment record;
  v_total_modules integer;
  v_completed_modules integer;
  v_new_progress integer;
  v_cert_code text;
  v_cert_id uuid;
BEGIN
  SELECT * INTO v_enrollment
  FROM public.lms_course_enrollments
  WHERE id = p_enrollment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment record not found';
  END IF;

  -- Record lesson progress
  INSERT INTO public.lms_lesson_progress (
    organization_id,
    enrollment_id,
    module_id,
    employee_id,
    is_completed,
    completed_at
  ) VALUES (
    v_enrollment.organization_id,
    p_enrollment_id,
    p_module_id,
    v_enrollment.employee_id,
    true,
    now()
  )
  ON CONFLICT (enrollment_id, module_id)
  DO UPDATE SET is_completed = true, completed_at = now();

  -- Recalculate course progress
  SELECT COUNT(*) INTO v_total_modules
  FROM public.lms_modules
  WHERE course_id = v_enrollment.course_id;

  SELECT COUNT(*) INTO v_completed_modules
  FROM public.lms_lesson_progress
  WHERE enrollment_id = p_enrollment_id AND is_completed = true;

  IF v_total_modules > 0 THEN
    v_new_progress := ROUND((v_completed_modules::numeric / v_total_modules::numeric) * 100);
  ELSE
    v_new_progress := 100;
  END IF;

  -- If course completed 100%, generate certificate
  IF v_new_progress >= 100 THEN
    v_cert_code := 'CERT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));

    INSERT INTO public.lms_certificates (
      organization_id,
      certificate_code,
      course_id,
      employee_id,
      enrollment_id,
      issue_date,
      final_score_percent
    ) VALUES (
      v_enrollment.organization_id,
      v_cert_code,
      v_enrollment.course_id,
      v_enrollment.employee_id,
      p_enrollment_id,
      CURRENT_DATE,
      100
    )
    ON CONFLICT (certificate_code) DO NOTHING
    RETURNING id INTO v_cert_id;

    UPDATE public.lms_course_enrollments
    SET
      progress_percent = 100,
      status = 'completed',
      completed_at = now(),
      certificate_id = v_cert_id,
      updated_at = now()
    WHERE id = p_enrollment_id;
  ELSE
    UPDATE public.lms_course_enrollments
    SET
      progress_percent = v_new_progress,
      status = 'in_progress',
      updated_at = now()
    WHERE id = p_enrollment_id;
  END IF;

  RETURN jsonb_build_object(
    'progress_percent', v_new_progress,
    'status', CASE WHEN v_new_progress >= 100 THEN 'completed' ELSE 'in_progress' END,
    'certificate_code', v_cert_code
  );
END;
$$;

-- E. Submit LMS Quiz Assessment
CREATE OR REPLACE FUNCTION public.submit_quiz_assessment(
  p_enrollment_id uuid,
  p_quiz_id uuid,
  p_answers jsonb -- e.g. [{"question_id": "...", "selected_option": 2}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_enrollment record;
  v_quiz record;
  v_question record;
  v_total_questions integer := 0;
  v_correct_count integer := 0;
  v_user_ans integer;
  v_score_percent integer;
  v_passed boolean;
  v_cert_code text;
  v_cert_id uuid;
BEGIN
  SELECT * INTO v_enrollment FROM public.lms_course_enrollments WHERE id = p_enrollment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment record not found'; END IF;

  SELECT * INTO v_quiz FROM public.lms_quizzes WHERE id = p_quiz_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quiz record not found'; END IF;

  -- Score the questions
  FOR v_question IN SELECT * FROM public.lms_quiz_questions WHERE quiz_id = p_quiz_id ORDER BY order_index LOOP
    v_total_questions := v_total_questions + 1;

    -- Extract candidate selection for this question
    SELECT (item->>'selected_option')::integer INTO v_user_ans
    FROM jsonb_array_elements(p_answers) AS item
    WHERE (item->>'question_id')::uuid = v_question.id;

    IF v_user_ans IS NOT NULL AND v_user_ans = v_question.correct_option_index THEN
      v_correct_count := v_correct_count + 1;
    END IF;
  END LOOP;

  IF v_total_questions > 0 THEN
    v_score_percent := ROUND((v_correct_count::numeric / v_total_questions::numeric) * 100);
  ELSE
    v_score_percent := 100;
  END IF;

  v_passed := v_score_percent >= COALESCE(v_quiz.passing_score_percent, 70);

  -- Record attempt
  INSERT INTO public.lms_quiz_attempts (
    organization_id,
    quiz_id,
    course_id,
    employee_id,
    enrollment_id,
    score_percent,
    passed,
    total_questions,
    correct_answers,
    answers
  ) VALUES (
    v_enrollment.organization_id,
    p_quiz_id,
    v_enrollment.course_id,
    v_enrollment.employee_id,
    p_enrollment_id,
    v_score_percent,
    v_passed,
    v_total_questions,
    v_correct_count,
    p_answers
  );

  -- If passed, check if we issue certificate
  IF v_passed THEN
    v_cert_code := 'CERT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));

    INSERT INTO public.lms_certificates (
      organization_id,
      certificate_code,
      course_id,
      employee_id,
      enrollment_id,
      issue_date,
      final_score_percent
    ) VALUES (
      v_enrollment.organization_id,
      v_cert_code,
      v_enrollment.course_id,
      v_enrollment.employee_id,
      p_enrollment_id,
      CURRENT_DATE,
      v_score_percent
    )
    ON CONFLICT (certificate_code) DO NOTHING
    RETURNING id INTO v_cert_id;

    UPDATE public.lms_course_enrollments
    SET
      progress_percent = 100,
      status = 'completed',
      completed_at = now(),
      certificate_id = v_cert_id,
      updated_at = now()
    WHERE id = p_enrollment_id;
  END IF;

  RETURN jsonb_build_object(
    'score_percent', v_score_percent,
    'passed', v_passed,
    'correct_answers', v_correct_count,
    'total_questions', v_total_questions,
    'certificate_code', v_cert_code
  );
END;
$$;

-- F. Bulk Assign Course to Employees
CREATE OR REPLACE FUNCTION public.assign_course_to_employees(
  p_course_id uuid,
  p_employee_ids uuid[],
  p_due_date date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_assigned_by uuid;
  v_org_id uuid;
  v_emp_id uuid;
  v_count integer := 0;
BEGIN
  SELECT id, organization_id INTO v_assigned_by, v_org_id
  FROM public.employees
  WHERE user_id = auth.uid()
  LIMIT 1;

  FOREACH v_emp_id IN ARRAY p_employee_ids LOOP
    INSERT INTO public.lms_course_enrollments (
      organization_id,
      course_id,
      employee_id,
      assigned_by,
      due_date,
      status
    ) VALUES (
      v_org_id,
      p_course_id,
      v_emp_id,
      v_assigned_by,
      p_due_date,
      'enrolled'
    )
    ON CONFLICT (course_id, employee_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 15. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.performance_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_peer_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_certificates ENABLE ROW LEVEL SECURITY;

-- Performance Cycles Policies
CREATE POLICY "Users can view performance cycles"
ON public.performance_cycles FOR SELECT
USING (true);

CREATE POLICY "HR and Admins can manage performance cycles"
ON public.performance_cycles FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- Performance Goals Policies:
-- Managers should only access authorized employees (themselves, employees who report to them, or HR admin)
CREATE POLICY "Users can view goals of self or team"
ON public.performance_goals FOR SELECT
USING (
  employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  employee_id IN (SELECT id FROM public.employees WHERE manager_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

CREATE POLICY "Employees and Managers can manage goals"
ON public.performance_goals FOR ALL
USING (
  employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  employee_id IN (SELECT id FROM public.employees WHERE manager_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- Performance Reviews Policies:
-- Managers should only access authorized employees
CREATE POLICY "Users can view reviews of self or direct reports"
ON public.performance_reviews FOR SELECT
USING (
  employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  reviewer_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  employee_id IN (SELECT id FROM public.employees WHERE manager_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

CREATE POLICY "Employees and Managers can update reviews"
ON public.performance_reviews FOR ALL
USING (
  employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  reviewer_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  employee_id IN (SELECT id FROM public.employees WHERE manager_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- Peer Feedbacks Policies
CREATE POLICY "Users can view peer feedbacks involving them"
ON public.performance_peer_feedbacks FOR SELECT
USING (
  peer_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

CREATE POLICY "Peers can submit peer feedbacks"
ON public.performance_peer_feedbacks FOR ALL
USING (
  peer_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- LMS Courses & Modules Policies
CREATE POLICY "Users can view published courses"
ON public.lms_courses FOR SELECT
USING (status = 'published' OR public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

CREATE POLICY "HR and Admins can manage courses"
ON public.lms_courses FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

CREATE POLICY "Users can view course modules"
ON public.lms_modules FOR SELECT
USING (true);

CREATE POLICY "HR and Admins can manage course modules"
ON public.lms_modules FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- LMS Enrollments Policies
CREATE POLICY "Users can view own or direct reports enrollments"
ON public.lms_course_enrollments FOR SELECT
USING (
  employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  employee_id IN (SELECT id FROM public.employees WHERE manager_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

CREATE POLICY "Users and HR can update enrollments"
ON public.lms_course_enrollments FOR ALL
USING (
  employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- LMS Lesson Progress Policies
CREATE POLICY "Users can manage own lesson progress"
ON public.lms_lesson_progress FOR ALL
USING (
  employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- LMS Quizzes & Questions Policies
CREATE POLICY "Users can view quizzes and questions"
ON public.lms_quizzes FOR SELECT
USING (true);

CREATE POLICY "HR can manage quizzes"
ON public.lms_quizzes FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

CREATE POLICY "Users can view quiz questions"
ON public.lms_quiz_questions FOR SELECT
USING (true);

CREATE POLICY "HR can manage quiz questions"
ON public.lms_quiz_questions FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- LMS Quiz Attempts Policies
CREATE POLICY "Users can view and insert own quiz attempts"
ON public.lms_quiz_attempts FOR ALL
USING (
  employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- LMS Certificates Policies
CREATE POLICY "Users can view own certificates or HR can view all"
ON public.lms_certificates FOR SELECT
USING (
  employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1) OR
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

CREATE POLICY "HR and system can manage certificates"
ON public.lms_certificates FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.is_superadmin(auth.uid())
);

-- 16. SEED STARTER PERFORMANCE CYCLE & LMS COURSES FOR SEAMLESS EXPERIENCE
DO $$
DECLARE
  v_admin_id uuid;
  v_cycle_id uuid;
  v_course1_id uuid;
  v_course2_id uuid;
  v_quiz1_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM public.employees WHERE is_superadmin = true OR user_id IS NOT NULL LIMIT 1;

  -- Seed performance cycle
  IF NOT EXISTS (SELECT 1 FROM public.performance_cycles LIMIT 1) THEN
    INSERT INTO public.performance_cycles (title, cycle_type, start_date, due_date, description, status, created_by)
    VALUES (
      'Annual Performance Appraisal 2026',
      'annual',
      CURRENT_DATE - INTERVAL '30 days',
      CURRENT_DATE + INTERVAL '60 days',
      'Company-wide annual performance evaluation cycle including self-assessment, manager reviews, and 360 peer feedback.',
      'active',
      v_admin_id
    ) RETURNING id INTO v_cycle_id;
  END IF;

  -- Seed courses
  IF NOT EXISTS (SELECT 1 FROM public.lms_courses LIMIT 1) THEN
    INSERT INTO public.lms_courses (title, description, category, level, estimated_duration_minutes, status, passing_score_percent, created_by)
    VALUES (
      'Information Security & Cyber Hygiene',
      'Essential cybersecurity training covering password safety, phishing detection, data protection standards, and remote access protocols.',
      'Compliance & Security',
      'beginner',
      45,
      'published',
      80,
      v_admin_id
    ) RETURNING id INTO v_course1_id;

    INSERT INTO public.lms_modules (course_id, sequence_order, title, description, content_type, duration_minutes, text_content)
    VALUES
      (v_course1_id, 1, 'Introduction to Workplace Cyber Risks', 'Understanding digital threats, social engineering, and unauthorized data breaches.', 'article', 15, 'Cyber hygiene is the set of routine practices and security measures employees undertake to protect sensitive company and personal data from cyber threats. Never share multi-factor authentication (MFA) codes, always verify sender domains on sensitive communications, and report suspicious activities immediately.'),
      (v_course1_id, 2, 'Safe Browsing and Phishing Prevention', 'Techniques for identifying fake emails, spoofed links, and malicious attachments.', 'article', 15, 'Phishing remains the #1 initial breach vector. Inspect hyperlinked URLs before clicking, check email headers for suspicious reply-to addresses, and do not download zip or executable attachments from unknown contacts.'),
      (v_course1_id, 3, 'Data Privacy & Password Policies', 'Industry standards on passphrase complexity, password managers, and data classification.', 'article', 15, 'Use passphrases with at least 14 characters or store credentials inside an enterprise password manager. Treat customer Personally Identifiable Information (PII) with strict confidentiality.');

    -- Seed Quiz
    INSERT INTO public.lms_quizzes (course_id, title, description, passing_score_percent)
    VALUES (v_course1_id, 'Security Awareness Knowledge Check', 'Assess your understanding of corporate cyber security policies and phishing recognition.', 70)
    RETURNING id INTO v_quiz1_id;

    INSERT INTO public.lms_quiz_questions (quiz_id, question, options, correct_option_index, explanation, order_index)
    VALUES
      (v_quiz1_id, 'What should you do if you receive an unexpected email requesting urgent gift cards or money transfer from an executive?', '["Comply immediately to be helpful", "Forward to all coworkers", "Verify directly through a separate verified channel (e.g. phone or in-person)", "Ignore your security team"]'::jsonb, 2, 'Always verify high-risk or financial requests through an independent, verified out-of-band communication channel.', 1),
      (v_quiz1_id, 'Which of the following describes a strong password practice?', '["Using your birth date and name", "Using a 16+ character unique passphrase or password manager", "Writing it on a sticky note under your keyboard", "Sharing it with your teammate during shifts"]'::jsonb, 1, 'Long unique passphrases or password manager generated credentials provide the highest protection against brute force attacks.', 2),
      (v_quiz1_id, 'What is Two-Factor Authentication (2FA)?', '["Entering your password twice", "An extra layer of security requiring two separate forms of identification", "A software that speeds up your computer", "Changing your password every 2 days"]'::jsonb, 1, '2FA requires two separate credentials (something you know like a password, and something you have like an authenticator app code).', 3);

    -- Seed Course 2
    INSERT INTO public.lms_courses (title, description, category, level, estimated_duration_minutes, status, passing_score_percent, created_by)
    VALUES (
      'Workplace Health & Diversity Inclusion',
      'Fostering an empathetic, respectful, and high-performing workplace culture built on psychological safety and equity.',
      'Culture & Leadership',
      'all_levels',
      30,
      'published',
      70,
      v_admin_id
    ) RETURNING id INTO v_course2_id;

    INSERT INTO public.lms_modules (course_id, sequence_order, title, description, content_type, duration_minutes, text_content)
    VALUES
      (v_course2_id, 1, 'Foundations of Workplace Psychological Safety', 'Why safe environments empower candid communication, innovation, and psychological resilience.', 'article', 15, 'Psychological safety is the belief that one will not be punished or humiliated for speaking up with ideas, questions, concerns, or mistakes. Leaders and team members cultivate this by actively listening, showing curiosity, and welcoming constructive debate.'),
      (v_course2_id, 2, 'Unconscious Bias and Micro-behaviors', 'Recognizing hidden assumptions and cultivating proactive inclusive habits.', 'article', 15, 'Unconscious bias refers to social stereotypes formed outside our conscious awareness. Active awareness helps ensure equitable recognition, objective performance reviews, and inclusive collaboration.');
  END IF;
END $$;
