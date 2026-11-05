-- 0003_superadmin_stealth_security.sql
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS is_superadmin boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_is_superadmin 
ON public.employees(is_superadmin);

ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS duplicate_scan_minutes integer DEFAULT 3;

ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS target_user_id uuid;

