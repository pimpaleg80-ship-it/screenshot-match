-- Permanently remove seeded/test sample records while preserving real admin accounts,
-- organization configuration, holidays, shifts, departments, leave types, and reference categories.

-- 1. Remove test engagement survey data
DELETE FROM public.engagement_answers
WHERE response_id IN (
  SELECT id FROM public.engagement_responses
  WHERE survey_id = '8c45a92d-a677-4a29-9d7a-b9e6a4743ba5'
);

DELETE FROM public.engagement_responses
WHERE survey_id = '8c45a92d-a677-4a29-9d7a-b9e6a4743ba5';

DELETE FROM public.engagement_questions
WHERE survey_id = '8c45a92d-a677-4a29-9d7a-b9e6a4743ba5';

DELETE FROM public.engagement_surveys
WHERE id = '8c45a92d-a677-4a29-9d7a-b9e6a4743ba5';

-- 2. Remove seeded starter job openings & performance cycle
DELETE FROM public.job_openings
WHERE id IN (
  '07a9fed6-c60a-4de8-bd5f-5d9b50efea34',
  '79dc125d-101a-4c3a-b8c4-3d9c37593e49',
  '0dc7731a-36ed-4052-adaf-6079eefbf899'
);

DELETE FROM public.performance_cycles
WHERE id = '0a8a32c6-644c-46e3-9450-25f629f490aa';

-- 3. Remove November 2026 test payroll run, payslips, history, and default salary structures
DELETE FROM public.payroll_history
WHERE payroll_run_id = '62e9887c-1a92-46e9-8586-7ee7892e7ce3';

DELETE FROM public.payslips
WHERE payroll_run_id = '62e9887c-1a92-46e9-8586-7ee7892e7ce3';

DELETE FROM public.payroll_runs
WHERE id = '62e9887c-1a92-46e9-8586-7ee7892e7ce3';

DELETE FROM public.employee_salary_structures;

-- 4. Remove test device, notifications, and test/verification audit logs
DELETE FROM public.registered_devices
WHERE device_uuid = 'test-device-pc';

DELETE FROM public.notifications;

DELETE FROM public.audit_logs;

-- 5. Remove the 3 orphaned test/auth-only accounts (preserving Harshad Pimpale & Admin Pimpale)
DELETE FROM public.organization_members
WHERE user_id IN (
  '8338e638-916d-4575-b428-ebe4f5ece473',
  '0d2879b9-31b8-4746-8b3c-25f3d7a9718e',
  '3b152007-d440-4526-9754-7cfce9a33f2b'
);

DELETE FROM public.user_roles
WHERE user_id IN (
  '8338e638-916d-4575-b428-ebe4f5ece473',
  '0d2879b9-31b8-4746-8b3c-25f3d7a9718e',
  '3b152007-d440-4526-9754-7cfce9a33f2b'
);

DELETE FROM auth.sessions
WHERE user_id IN (
  '8338e638-916d-4575-b428-ebe4f5ece473',
  '0d2879b9-31b8-4746-8b3c-25f3d7a9718e',
  '3b152007-d440-4526-9754-7cfce9a33f2b'
);

DELETE FROM auth.identities
WHERE user_id IN (
  '8338e638-916d-4575-b428-ebe4f5ece473',
  '0d2879b9-31b8-4746-8b3c-25f3d7a9718e',
  '3b152007-d440-4526-9754-7cfce9a33f2b'
);

DELETE FROM auth.users
WHERE id IN (
  '8338e638-916d-4575-b428-ebe4f5ece473',
  '0d2879b9-31b8-4746-8b3c-25f3d7a9718e',
  '3b152007-d440-4526-9754-7cfce9a33f2b'
);
