# 09. Database Target Schema Specification

**Target Database**: Supabase PostgreSQL 15+  
**Design Standard**: Multi-Tenant (Tenant-Discriminated by `organization_id`), 3NF Normalization, Strict Foreign Key Cascades, Index Optimization for Supabase Free Tier  
**Entity Classification**: Reused Existing Tables vs. New Proposed Tables  

---

## 1. Entity Classification & Reuse Map

| Target Entity Name | Status | Existing Table in Supabase | Migration Strategy |
|---|---|---|---|
| `organizations` | **NEW** | *None* | Create new core tenant registry table. |
| `organization_members` | **NEW** | *user_roles* | Replace global `user_roles` with tenant-scoped membership table. |
| `employees` | **REUSE & UPGRADE** | `employees` | Add `organization_id`, `work_location_id`, `default_shift_id`. |
| `departments` | **REUSE & UPGRADE** | `departments` | Add `organization_id`. |
| `designations` | **NEW** | *None* | Normalize text designations from `employees.designation`. |
| `work_locations` | **NEW** | *None* | Office locations with lat/long and default radius. |
| `geofence_zones` | **NEW** | *None* | Circular or polygon boundaries linked to work locations. |
| `employee_location_assignments` | **NEW** | *None* | Mapping table linking employees to authorized work locations. |
| `registered_devices` | **NEW** | *None* | Hardware binding table storing device UUID and model. |
| `geofence_events` | **NEW** | *None* | Temporary rolling 90-day log of native enter/exit events. |
| `attendance_sessions` | **REUSE & UPGRADE** | `attendance` | Upgrade `attendance` into full session entity with location proof. |
| `attendance_events` | **NEW** | *None* | Immutable record of individual button tap actions. |
| `attendance_exceptions` | **NEW** | *None* | Late entries, early departures, and regularization requests. |
| `attendance_monthly_summaries` | **NEW** | *None* | Canonical monthly pre-aggregated attendance metrics. |
| `shifts` | **NEW** | *settings (work_start/end)* | Multi-shift support (General, Morning, Night shifts). |
| `employee_shift_assignments` | **NEW** | *None* | Employee-to-shift mapping with effective date ranges. |
| `leave_types` | **REUSE & UPGRADE** | `leave_types` | Add `organization_id`. |
| `leave_requests` | **REUSE & UPGRADE** | `leave_requests` | Add `organization_id`. |
| `leave_balances` | **REUSE & UPGRADE** | `leave_balances` | Add `organization_id`. |
| `holidays` | **REUSE & UPGRADE** | `holidays` | Add `organization_id`, `work_location_id`. |
| `attendance_archives` | **REUSE & UPGRADE** | `drive_connection` | Scoped by `organization_id` for multi-tenant Drive connections. |
| `archive_files` | **REUSE & UPGRADE** | `drive_backups` | Store individual employee PDF links and checksums. |
| `archive_jobs` | **NEW** | *None* | Monthly batch execution tracking and manifest records. |

---

## 2. Core SaaS & Multi-Tenancy Module

### `organizations`
```sql
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  logo_url text,
  plan_tier text NOT NULL DEFAULT 'starter', -- starter, pro, enterprise
  max_employees integer NOT NULL DEFAULT 50,
  gps_retention_days integer NOT NULL DEFAULT 90,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON public.organizations(slug);
```

### `organization_members`
```sql
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'hr_manager', 'employee')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'invited')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
```

---

## 3. Geofencing & Work Locations Module

### `work_locations`
```sql
CREATE TABLE public.work_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, -- e.g. "Pune HQ - Tower B"
  address text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_locations_org ON public.work_locations(organization_id);
```

### `geofence_zones`
```sql
CREATE TABLE public.geofence_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.work_locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'circle' CHECK (zone_type IN ('circle', 'polygon')),
  polygon_coordinates jsonb, -- Array of [lat, lon] coordinates
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### `employee_location_assignments`
```sql
CREATE TABLE public.employee_location_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.work_locations(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, location_id)
);

CREATE INDEX idx_emp_location_emp ON public.employee_location_assignments(employee_id);
```

### `registered_devices`
```sql
CREATE TABLE public.registered_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  device_uuid text NOT NULL,
  device_model text,
  operating_system text, -- Android, iOS
  is_active boolean NOT NULL DEFAULT true,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, device_uuid)
);

CREATE INDEX idx_registered_devices_uuid ON public.registered_devices(device_uuid);
```

### `geofence_events` (Temporary 90-Day Retention)
```sql
CREATE TABLE public.geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('ENTER', 'EXIT', 'DWELL')),
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  is_mock boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_geofence_events_retention ON public.geofence_events(recorded_at);
CREATE INDEX idx_geofence_events_emp_time ON public.geofence_events(employee_id, recorded_at DESC);
```

---

## 4. Attendance Module

### `attendance_sessions` (Upgraded from `attendance`)
```sql
CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  check_in_time timestamptz NOT NULL,
  check_out_time timestamptz,
  total_hours numeric(5,2),
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'half_day', 'absent', 'on_leave', 'holiday')),
  check_in_method text NOT NULL DEFAULT 'manual_geofence' CHECK (check_in_method IN ('manual_geofence', 'kiosk_face', 'admin_regularized')),
  check_out_method text CHECK (check_out_method IN ('manual_geofence', 'kiosk_face', 'admin_regularized', 'auto_closed')),
  check_in_lat double precision,
  check_in_lon double precision,
  check_out_lat double precision,
  check_out_lon double precision,
  device_id uuid REFERENCES public.registered_devices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_id, session_date)
);

CREATE INDEX idx_attendance_org_date ON public.attendance_sessions(organization_id, session_date);
CREATE INDEX idx_attendance_emp_date ON public.attendance_sessions(employee_id, session_date DESC);
```

### `attendance_exceptions`
```sql
CREATE TABLE public.attendance_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  exception_type text NOT NULL CHECK (exception_type IN ('MISSED_CHECKOUT', 'OUTSIDE_GEOFENCE', 'LATE_ARRIVAL', 'EARLY_DEPARTURE')),
  reason text NOT NULL,
  regularization_status text NOT NULL DEFAULT 'pending' CHECK (regularization_status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.employees(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exceptions_status ON public.attendance_exceptions(organization_id, regularization_status);
```

### `attendance_monthly_summaries`
```sql
CREATE TABLE public.attendance_monthly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  total_working_days integer NOT NULL,
  days_present integer NOT NULL DEFAULT 0,
  days_late integer NOT NULL DEFAULT 0,
  days_half_day integer NOT NULL DEFAULT 0,
  days_absent integer NOT NULL DEFAULT 0,
  days_on_leave integer NOT NULL DEFAULT 0,
  total_hours_worked numeric(7,2) NOT NULL DEFAULT 0,
  is_locked boolean NOT NULL DEFAULT false,
  pdf_archive_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_id, year, month)
);

CREATE INDEX idx_monthly_summary_lookup ON public.attendance_monthly_summaries(organization_id, year, month);
```

---

## 5. Google Drive Archival Module

### `attendance_archives`
```sql
CREATE TABLE public.attendance_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  root_folder_id text NOT NULL,
  auto_backup_enabled boolean NOT NULL DEFAULT true,
  last_archive_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### `archive_jobs` & `archive_files`
```sql
CREATE TABLE public.archive_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_files_expected integer NOT NULL DEFAULT 0,
  total_files_uploaded integer NOT NULL DEFAULT 0,
  manifest_sha256 text,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.archive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.archive_jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL, -- Null for Master Org PDF
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('master_summary', 'employee_report')),
  drive_file_id text NOT NULL,
  drive_web_link text,
  sha256_hash text NOT NULL,
  file_size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_archive_files_job ON public.archive_files(job_id);
```

