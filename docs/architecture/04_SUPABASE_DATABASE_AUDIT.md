# 04. Live Supabase Database Schema Inventory & Audit

**Connected Database**: Supabase PostgreSQL (`mnnecoyqofhrivxufhqm.supabase.co`)  
**Region**: `aws-0-ap-southeast-1` (Singapore)  
**PostgreSQL Version**: 15+ with `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault` extensions  
**Audit Method**: Direct PostgreSQL system catalog queries (`pg_class`, `information_schema`, `pg_proc`, `pg_trigger`, `pg_policies`)

---

## 1. Schema Overview

The live database consists of:

- **16 Tables** in `public` schema (all 16 have Row-Level Security explicitly enabled).
- **2 Views** (`people`, `face_descriptors`) with `INSTEAD OF` triggers for legacy compatibility.
- **39 RLS Policies** enforcing role-based permissions.
- **19 Stored Functions** handling authentication, user provisioning, leave triggers, and role verification.
- **10 Database Triggers** enforcing business constraints and audit logging.
- **3 Custom Enum Types** (`app_role`, `leave_status`, `attendance_status`).
- **4 Storage Buckets** (`leave-attachments`, `documents`, `announcements`, `avatars`).

---

## 2. Comprehensive Table-by-Table Inventory

### 1. `employees`

- **Purpose**: Core personnel directory storing identity, employee code, department assignment, manager hierarchy, and superadmin flag.
- **Organization Ownership**: **None (Single-Tenant)**.
- **Important Columns**:
  - `id` (uuid, PK, default `gen_random_uuid()`)
  - `user_id` (uuid, unique, FK -> `auth.users.id`, nullable)
  - `employee_code` (text, not null, unique)
  - `full_name` (text, not null)
  - `email` (text, not null, unique)
  - `phone` (text, nullable)
  - `department_id` (uuid, FK -> `departments.id`, nullable)
  - `designation` (text, nullable)
  - `manager_id` (uuid, FK -> `employees.id`, self-referencing hierarchy)
  - `joining_date` (date, default `CURRENT_DATE`)
  - `status` (text, default `'active'`)
  - `photo_url` (text, nullable)
  - `is_superadmin` (boolean, default `false`)
- **Foreign Keys**: `department_id` -> `departments(id)`, `manager_id` -> `employees(id)`, `user_id` -> `auth.users(id)`.
- **RLS Status**: **ENABLED** (6 policies).
  - Admins can manage all employees.
  - Employees can select and update own phone/photo.
  - Managers can select and insert direct team members.
- **Identified Issues**: Missing `organization_id`, missing `work_location_id`, missing shift assignment.

---

### 2. `attendance`

- **Purpose**: Daily work presence records capturing check-in timestamp, check-out timestamp, and attendance status.
- **Organization Ownership**: **None (Single-Tenant)**.
- **Important Columns**:
  - `id` (uuid, PK, default `gen_random_uuid()`)
  - `employee_id` (uuid, not null, FK -> `employees.id`)
  - `date` (date, not null)
  - `check_in` (timestamptz, nullable)
  - `check_out` (timestamptz, nullable)
  - `status` (`attendance_status` enum: `present`, `late`, `absent`, `half_day`, `on_leave`, `holiday`, `weekly_off`)
  - `method` (text, default `'face'`)
  - `confidence` (numeric, nullable)
  - `note` (text, nullable)
  - `created_at` (timestamptz, default `now()`)
- **Unique Constraint**: Unique composite on `(employee_id, date)`.
- **Foreign Keys**: `employee_id` -> `employees(id)`.
- **RLS Status**: **ENABLED** (3 policies).
  - Admins have full access.
  - Employees can view own records.
  - Managers can view and update team attendance.
- **Identified Issues**:
  - **No GPS or location columns** (`latitude`, `longitude`, `work_location_id`, `distance_meters`).
  - **No device identity verification** (`device_id`, `device_model`).
  - Supports only one session per day (cannot model split shifts or multi-entry days).

---

### 3. `user_roles`

- **Purpose**: Role assignment mapping users to permission levels.
- **Organization Ownership**: **None (Single-Tenant)**.
- **Important Columns**:
  - `id` (uuid, PK, default `gen_random_uuid()`)
  - `user_id` (uuid, not null, FK -> `auth.users.id`)
  - `role` (`app_role` enum: `admin`, `manager`, `employee`)
- **Foreign Keys**: `user_id` -> `auth.users(id)`.
- **RLS Status**: **ENABLED** (2 policies: admin all, user select own).
- **Identified Issues**: Roles are global rather than scoped per organization.

---

### 4. `departments`

- **Purpose**: Organizational units/departments (e.g., Engineering, Sales, Human Resources).
- **Organization Ownership**: **None (Single-Tenant)**.
- **Important Columns**:
  - `id` (uuid, PK, default `gen_random_uuid()`)
  - `name` (text, not null)
  - `created_at` (timestamptz)
- **RLS Status**: **ENABLED** (2 policies: admin write, authenticated read all).
- **Identified Issues**: Departments cannot be scoped per tenant organization.

---

### 5. `leave_requests`

- **Purpose**: Employee leave applications, approval workflows, and manager/admin comments.
- **Organization Ownership**: **None (Single-Tenant)**.
- **Important Columns**:
  - `id` (uuid, PK, default `gen_random_uuid()`)
  - `employee_id` (uuid, not null, FK -> `employees.id`)
  - `leave_type_id` (uuid, not null, FK -> `leave_types.id`)
  - `from_date` (date, not null)
  - `to_date` (date, not null)
  - `days` (numeric, not null)
  - `half_day` (boolean, default `false`)
  - `reason` (text, nullable)
  - `attachment_url` (text, nullable)
  - `status` (`leave_status` enum: `pending`, `approved`, `rejected`, `cancelled`)
  - `manager_id` (uuid, FK -> `employees.id`)
  - `manager_comment` (text)
  - `admin_id` (uuid, FK -> `employees.id`)
  - `admin_comment` (text)
  - `applied_at` (timestamptz, default `now()`)
  - `decided_at` (timestamptz)
- **RLS Status**: **ENABLED** (5 policies).
- **Triggers**:
  - `trg_block_overlap`: Prevents overlapping leave dates for the same employee.
  - `trg_leave_status_change`: Deducts or refunds quota in `leave_balances`.
  - `trg_notify_leave_apply` & `trg_notify_leave_decision`: Inserts alerts.

---

### 6. `leave_balances`

- **Purpose**: Annual employee leave quotas and consumed days.
- **Organization Ownership**: **None (Single-Tenant)**.
- **Important Columns**:
  - `id` (uuid, PK, default `gen_random_uuid()`)
  - `employee_id` (uuid, not null, FK -> `employees.id`)
  - `leave_type_id` (uuid, not null, FK -> `leave_types.id`)
  - `year` (integer, not null)
  - `total` (numeric, not null)
  - `used` (numeric, default `0`)
  - `remaining` (numeric, generated or maintained)
- **Unique Constraint**: Unique composite on `(employee_id, leave_type_id, year)`.
- **RLS Status**: **ENABLED** (3 policies).

---

### 7. `leave_types`

- **Purpose**: Catalog of available leave categories (Casual Leave, Sick Leave, Paid Leave).
- **Organization Ownership**: **None (Single-Tenant)**.
- **Important Columns**:
  - `id` (uuid, PK)
  - `name` (text, not null)
  - `days_per_year` (numeric, default `12`)
  - `is_paid` (boolean, default `true`)
  - `created_at` (timestamptz)
- **RLS Status**: **ENABLED** (2 policies: admin write, all read).

---

### 8. `face_data`

- **Purpose**: Biometric facial recognition descriptors and employee consent.
- **Organization Ownership**: **None (Single-Tenant)**.
- **Important Columns**:
  - `id` (uuid, PK)
  - `employee_id` (uuid, FK -> `employees.id`)
  - `descriptor` (jsonb, 128-element numerical array)
  - `consent` (boolean, not null)
  - `enrolled_at` (timestamptz)
- **RLS Status**: **ENABLED** (1 policy: `admin only`).

---

### 9. `drive_connection` & `drive_backups`

- **Purpose**: Google Drive OAuth 2.0 connection credentials and file upload audit log.
- **Organization Ownership**: **None (Single-Tenant Singleton)**.
- **Columns (`drive_connection`)**: `id`, `google_email`, `refresh_token_encrypted`, `root_folder_id`, `connected_at`, `connected_by`, `auto_backup_on_pdf`, `daily_backup`.
- **Columns (`drive_backups`)**: `id`, `file_type`, `file_name`, `drive_file_id`, `drive_link`, `period_start`, `period_end`, `status`, `error_message`, `retry_count`, `created_at`.
- **RLS Status**: **ENABLED** (admin only).
- **Critical Gap**: `drive_connection` is restricted to one company; connecting a second organization overwrites the first.

---

### 10. `settings`

- **Purpose**: Global configuration for work hours, shift times, late grace period, weekly offs, and biometric match thresholds.
- **Organization Ownership**: **None (Single-Tenant Singleton, ID=1)**.
- **Important Columns**: `id`, `work_start`, `work_end`, `late_grace_minutes`, `weekly_off_days`, `face_match_threshold`, `approval_flow`, `store_capture_photos`, `retention_days`, `email_notifications`, `duplicate_scan_minutes`.
- **RLS Status**: **ENABLED** (admin write, all read).

---

### 11. `audit_logs`, `holidays`, `documents`, `notifications`

- `audit_logs`: System activity trail (`user_id`, `user_email`, `action`, `details`, `target_user_id`, `created_at`).
- `holidays`: Calendar dates flagged as company-wide non-working holidays (`date`, `title`, `description`).
- `documents`: HR policies and company documents (`title`, `file_url`, `drive_link`, `drive_file_id`, `file_type`).
- `notifications`: User-directed alerts for leave requests, approvals, and system announcements.

---

## 3. Database Views & Trigger-Based Abstractions

1. **`people` View**:

   ```sql
   SELECT e.id, e.full_name AS name, e.employee_code AS person_code,
          COALESCE(d.name, 'General') AS department, e.email, e.phone,
          true AS consent, (e.status = 'active') AS active, e.photo_url, e.created_at
   FROM employees e
   LEFT JOIN departments d ON d.id = e.department_id
   WHERE e.is_superadmin IS NOT TRUE;
   ```

   _Purpose_: Provides a simplified employee roster while hiding accounts flagged with `is_superadmin = true`. Backed by `INSTEAD OF` triggers (`trg_people_insert`, `trg_people_update`, `trg_people_delete`) mapping modifications back to `public.employees`.

2. **`face_descriptors` View**:
   ```sql
   SELECT employee_id AS person_id, descriptor, 1 AS samples, enrolled_at AS updated_at
   FROM face_data;
   ```
   _Purpose_: Exposes biometric face data under legacy schema names for kiosk backward compatibility.

---

## 4. Applied Migrations History

1. `0000_facetime_attendance_schema.sql` (Initial core schema: employees, attendance, face data, settings).
2. `0001_google_drive_backup_schema.sql` (`drive_connection` and `drive_backups`).
3. `0002_corporate_workflow_schema.sql` (Leaves, balances, holidays, documents, announcements, notifications).
4. `0003_superadmin_stealth_security.sql` (`is_superadmin` column, duplicate scan minutes, stealth separation).
5. `0004_admin_employee_stealth_provisioning.sql` (`admin_create_employee` function).
6. `0005_fix_pgcrypto_search_path_and_employee_provisioning.sql` (Resolved `pgcrypto` search path and trigger duplication).
