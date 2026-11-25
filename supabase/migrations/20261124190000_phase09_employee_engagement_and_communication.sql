-- ==============================================================================
-- FLOWPEOPLE — PHASE 09: EMPLOYEE ENGAGEMENT & INTERNAL COMMUNICATION
-- ==============================================================================

-- 1. Extend announcements table with category, priority, published status, and summary
ALTER TABLE public.announcements 
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'announcement',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS published_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS summary text;

-- Add check constraints if not existing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'announcements_category_check'
  ) THEN
    ALTER TABLE public.announcements 
      ADD CONSTRAINT announcements_category_check 
      CHECK (category IN ('announcement', 'news', 'circular', 'policy_update', 'celebration'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'announcements_priority_check'
  ) THEN
    ALTER TABLE public.announcements 
      ADD CONSTRAINT announcements_priority_check 
      CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_announcements_org_pub 
  ON public.announcements (organization_id, is_published, created_at DESC);

-- 2. Announcement Read Receipts
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcement_reads_announcement_emp_unique UNIQUE (announcement_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON public.announcement_reads (announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_employee ON public.announcement_reads (employee_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_org ON public.announcement_reads (organization_id);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view announcement reads in their org"
  ON public.announcement_reads FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can record their own read receipts"
  ON public.announcement_reads FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- 3. Engagement Surveys & Polls
CREATE TABLE IF NOT EXISTS public.engagement_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'survey' CHECK (type IN ('poll', 'survey', 'feedback_form', 'suggestion_box', 'satisfaction')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'department')),
  target_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  show_live_results boolean NOT NULL DEFAULT true,
  allow_multiple_submissions boolean NOT NULL DEFAULT false,
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_surveys_org_status 
  ON public.engagement_surveys (organization_id, status, created_at DESC);

ALTER TABLE public.engagement_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view visible surveys"
  ON public.engagement_surveys FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can manage surveys"
  ON public.engagement_surveys FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- 4. Survey Questions
CREATE TABLE IF NOT EXISTS public.engagement_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.engagement_surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice', 'rating_scale', 'text', 'boolean', 'nps')),
  options jsonb DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  scale_min integer DEFAULT 1,
  scale_max integer DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_questions_survey 
  ON public.engagement_questions (survey_id, order_index ASC);

ALTER TABLE public.engagement_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view questions for visible surveys"
  ON public.engagement_questions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can manage questions"
  ON public.engagement_questions FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- 5. Survey Responses (Cryptographically Protected for Anonymity)
CREATE TABLE IF NOT EXISTS public.engagement_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.engagement_surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  respondent_hash text,
  is_anonymous boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_anonymity_integrity CHECK (
    (is_anonymous = true AND employee_id IS NULL AND user_id IS NULL AND respondent_hash IS NOT NULL) OR
    (is_anonymous = false AND employee_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_responses_non_anon_unique
  ON public.engagement_responses (survey_id, employee_id)
  WHERE (is_anonymous = false);

CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_responses_anon_unique
  ON public.engagement_responses (survey_id, respondent_hash)
  WHERE (is_anonymous = true);

CREATE INDEX IF NOT EXISTS idx_engagement_responses_survey
  ON public.engagement_responses (survey_id);

ALTER TABLE public.engagement_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view survey responses"
  ON public.engagement_responses FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert survey responses"
  ON public.engagement_responses FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- 6. Survey Answers
CREATE TABLE IF NOT EXISTS public.engagement_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.engagement_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.engagement_questions(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.engagement_surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  answer_text text,
  selected_options jsonb DEFAULT '[]'::jsonb,
  rating_value numeric(4, 2),
  boolean_value boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_answers_question ON public.engagement_answers (question_id);
CREATE INDEX IF NOT EXISTS idx_engagement_answers_survey ON public.engagement_answers (survey_id);
CREATE INDEX IF NOT EXISTS idx_engagement_answers_response ON public.engagement_answers (response_id);

ALTER TABLE public.engagement_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view survey answers"
  ON public.engagement_answers FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert survey answers"
  ON public.engagement_answers FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- 7. Employee Suggestions Box
CREATE TABLE IF NOT EXISTS public.employee_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Workplace Culture' CHECK (category IN ('Operations', 'Workplace Culture', 'Technology & Tools', 'Cost Saving', 'Wellness', 'Other')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'planned', 'implemented', 'declined')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  upvotes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_suggestions_org_status 
  ON public.employee_suggestions (organization_id, status, created_at DESC);

ALTER TABLE public.employee_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view suggestions"
  ON public.employee_suggestions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can submit suggestions"
  ON public.employee_suggestions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update suggestions"
  ON public.employee_suggestions FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- 8. Employee Suggestion Upvotes
CREATE TABLE IF NOT EXISTS public.employee_suggestion_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.employee_suggestions(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_suggestion_upvotes_unique UNIQUE (suggestion_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_suggestion_upvotes_suggestion 
  ON public.employee_suggestion_upvotes (suggestion_id);

ALTER TABLE public.employee_suggestion_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view upvotes"
  ON public.employee_suggestion_upvotes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage their upvotes"
  ON public.employee_suggestion_upvotes FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- 9. Transactional PostgreSQL RPCs

-- A. Submit Survey Response (with Cryptographic Anonymity Protection)
CREATE OR REPLACE FUNCTION public.submit_engagement_survey_response(
  _survey_id uuid,
  _employee_id uuid,
  _answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_survey record;
  v_emp record;
  v_hash text;
  v_response_id uuid;
  v_ans jsonb;
  v_q_id uuid;
  v_ans_text text;
  v_options jsonb;
  v_rating numeric;
  v_bool boolean;
  v_parsed_answers jsonb;
BEGIN
  -- 1. Fetch survey
  SELECT * INTO v_survey
  FROM public.engagement_surveys
  WHERE id = _survey_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Survey not found.');
  END IF;

  IF v_survey.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This survey is currently closed or inactive.');
  END IF;

  IF v_survey.end_date IS NOT NULL AND v_survey.end_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'This survey ended on ' || v_survey.end_date::text);
  END IF;

  -- 2. Fetch employee details
  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = _employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee record not found.');
  END IF;

  -- 3. Check department targeting if configured
  IF v_survey.target_audience = 'department' AND v_survey.target_department_id IS NOT NULL THEN
    IF v_emp.department_id IS DISTINCT FROM v_survey.target_department_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'This survey is designated for a different department.');
    END IF;
  END IF;

  -- 4. Anonymity handling & duplicate prevention
  IF v_survey.is_anonymous THEN
    -- Deterministic one-way hash without storing raw employee_id
    v_hash := encode(sha256((_survey_id::text || ':' || _employee_id::text || ':flowpeople_engagement_salt')::bytea), 'hex');
    
    IF NOT v_survey.allow_multiple_submissions THEN
      IF EXISTS (
        SELECT 1 FROM public.engagement_responses
        WHERE survey_id = _survey_id AND respondent_hash = v_hash
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have already submitted a response to this anonymous survey.');
      END IF;
    END IF;

    -- Insert response with completely stripped identity
    INSERT INTO public.engagement_responses (
      survey_id,
      organization_id,
      employee_id,
      user_id,
      respondent_hash,
      is_anonymous
    ) VALUES (
      _survey_id,
      v_survey.organization_id,
      NULL,
      NULL,
      v_hash,
      true
    ) RETURNING id INTO v_response_id;

  ELSE
    -- Non-anonymous survey
    IF NOT v_survey.allow_multiple_submissions THEN
      IF EXISTS (
        SELECT 1 FROM public.engagement_responses
        WHERE survey_id = _survey_id AND employee_id = _employee_id
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have already submitted a response to this survey.');
      END IF;
    END IF;

    INSERT INTO public.engagement_responses (
      survey_id,
      organization_id,
      employee_id,
      user_id,
      respondent_hash,
      is_anonymous
    ) VALUES (
      _survey_id,
      v_survey.organization_id,
      _employee_id,
      auth.uid(),
      NULL,
      false
    ) RETURNING id INTO v_response_id;
  END IF;

  -- 5. Insert answers (handle string or array jsonb)
  IF jsonb_typeof(_answers) = 'string' THEN
    v_parsed_answers := (_answers #>> '{}')::jsonb;
  ELSE
    v_parsed_answers := _answers;
  END IF;

  IF jsonb_typeof(v_parsed_answers) = 'array' THEN
    FOR v_ans IN SELECT * FROM jsonb_array_elements(v_parsed_answers)
    LOOP
      v_q_id := (v_ans->>'question_id')::uuid;
      v_ans_text := v_ans->>'answer_text';
      v_options := COALESCE(v_ans->'selected_options', '[]'::jsonb);
      v_rating := (v_ans->>'rating_value')::numeric;
      v_bool := (v_ans->>'boolean_value')::boolean;

      INSERT INTO public.engagement_answers (
        response_id,
        question_id,
        survey_id,
        organization_id,
        answer_text,
        selected_options,
        rating_value,
        boolean_value
      ) VALUES (
        v_response_id,
        v_q_id,
        _survey_id,
        v_survey.organization_id,
        v_ans_text,
        v_options,
        v_rating,
        v_bool
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'response_id', v_response_id,
    'is_anonymous', v_survey.is_anonymous
  );
END;
$$;

-- B. Toggle Suggestion Upvote
CREATE OR REPLACE FUNCTION public.toggle_suggestion_upvote(
  _suggestion_id uuid,
  _employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sug record;
  v_exists boolean;
  v_new_count integer;
BEGIN
  SELECT * INTO v_sug FROM public.employee_suggestions WHERE id = _suggestion_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Suggestion not found.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.employee_suggestion_upvotes
    WHERE suggestion_id = _suggestion_id AND employee_id = _employee_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Remove upvote
    DELETE FROM public.employee_suggestion_upvotes
    WHERE suggestion_id = _suggestion_id AND employee_id = _employee_id;

    UPDATE public.employee_suggestions
    SET upvotes_count = GREATEST(0, upvotes_count - 1),
        updated_at = now()
    WHERE id = _suggestion_id
    RETURNING upvotes_count INTO v_new_count;

    RETURN jsonb_build_object('success', true, 'upvoted', false, 'upvotes_count', v_new_count);
  ELSE
    -- Add upvote
    INSERT INTO public.employee_suggestion_upvotes (
      suggestion_id,
      employee_id,
      organization_id
    ) VALUES (
      _suggestion_id,
      _employee_id,
      v_sug.organization_id
    );

    UPDATE public.employee_suggestions
    SET upvotes_count = upvotes_count + 1,
        updated_at = now()
    WHERE id = _suggestion_id
    RETURNING upvotes_count INTO v_new_count;

    RETURN jsonb_build_object('success', true, 'upvoted', true, 'upvotes_count', v_new_count);
  END IF;
END;
$$;

-- C. Mark Announcement Read
CREATE OR REPLACE FUNCTION public.mark_announcement_read(
  _announcement_id uuid,
  _employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ann record;
  v_read_id uuid;
BEGIN
  SELECT * INTO v_ann FROM public.announcements WHERE id = _announcement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Announcement not found.');
  END IF;

  INSERT INTO public.announcement_reads (
    announcement_id,
    employee_id,
    user_id,
    organization_id,
    read_at
  ) VALUES (
    _announcement_id,
    _employee_id,
    auth.uid(),
    v_ann.organization_id,
    now()
  )
  ON CONFLICT (announcement_id, employee_id)
  DO UPDATE SET read_at = now()
  RETURNING id INTO v_read_id;

  RETURN jsonb_build_object('success', true, 'read_id', v_read_id);
END;
$$;

-- 10. Enable Supabase Realtime Publication
DO $$
BEGIN
  -- Ensure tables are published to supabase_realtime
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_reads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.engagement_surveys;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.engagement_responses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_suggestions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_suggestion_upvotes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
