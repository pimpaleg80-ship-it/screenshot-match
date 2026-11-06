# 05. Multi-Tenant Security & Row-Level Security (RLS) Audit

**Focus**: Multi-Tenant Isolation, Role-Based Access Control (RBAC), and RLS Policies  
**Current State**: 100% of tables have RLS enabled (39 policies), but **0% of policies enforce multi-tenant isolation**.  

---

## 1. Role-Permission Matrix

The table below contrasts the **current implementation** against the **target multi-tenant architecture**:

| Capability / Entity | Current Model | Target Multi-Tenant Model |
|---|---|---|
| **Role Hierarchy** | 3 enum roles: `admin`, `manager`, `employee` + `is_superadmin` flag in `employees`. | 4 SaaS roles: `super_admin` (platform root), `org_admin` (tenant owner), `hr_manager` (HR & Operations), `employee` (individual contributor). |
| **Super Admin Access** | Root clearance across all tables via `has_role(auth.uid(), 'admin')` and `is_superadmin = true`. | Global platform administration, organization provisioning, tenant quota management, and billing. Cannot access tenant private records without explicit impersonation audit. |
| **Organization Admin Access** | Full unrestricted access to the entire database (co-mingled with all other users). | Complete administrative control **strictly isolated to their own organization** (`organization_id`). Can manage branch locations, shifts, policies, and company Drive connections. |
| **HR Manager Access** | `manager` role limited by `manager_id` or `department_id` hierarchy. | Organization-scoped management of attendance regularizations, leave approvals, employee onboarding, and branch shift assignments across their organization. |
| **Employee Access** | Can read own employee record, leave balance, and attendance. | Self-service access strictly limited to own employee record within their active organization: view roster, apply for leaves, and press manual attendance buttons when inside geofence. |

---

## 2. Identified Security Vulnerabilities & Cross-Tenant Risks

### 1. Complete Absence of Tenant Scoping (Critical Data Leakage Risk)
- **Vulnerability**: Every single RLS policy currently checks `has_role(auth.uid(), 'admin'::app_role)`.
- **Impact**: If Organization B signs up, an administrator of Organization B will instantly see all employees, salary codes, personal phone numbers, and attendance records of Organization A.
- **Root Cause**: Tables lack `organization_id`, and helper function `has_role` only queries global `public.user_roles` without organization qualification.

### 2. Singleton Settings and Drive Integration
- **Vulnerability**: The `settings` table has a single row (`id = 1`) and `drive_connection` has a single row.
- **Impact**: Any admin can overwrite working hours, late grace minutes, and facial recognition thresholds for all companies using the system.
- **Drive Token Overwrite**: If Company B connects their Google Drive, Company A's encrypted refresh token is permanently replaced, and Company A's monthly PDF reports will be uploaded directly into Company B's Google Drive.

### 3. Service-Role Key Bypass in Edge Functions
- **Vulnerability**: Edge functions (`google-drive-upload`, `google-drive-daily-backup`) instantiate Supabase client with `SUPABASE_SERVICE_ROLE_KEY`.
- **Impact**: The service-role key completely bypasses RLS. Because the function payloads currently accept raw IDs without verifying whether the caller belongs to the target organization, a rogue authenticated request could trigger PDF generation and upload for any arbitrary employee ID in the database.

### 4. Client-Controlled Attendance Insertion
- **Vulnerability**: In `src/routes/_authenticated/attendance.tsx`, `addMutation` directly calls:
  `supabase.from("attendance").upsert({ employee_id, date, check_in, check_out, method: "manual" })`.
- **Impact**: Any user with `admin` role can fabricate check-in and check-out timestamps without cryptographic proof, device verification, or GPS validation.

---

## 3. Target Multi-Tenant RLS Policy Architecture

To achieve mathematical tenant isolation at the database level, the following RLS paradigm must be implemented in Phase 2.

### 1. Tenant Context Resolution Functions
```sql
-- Retrieve active organization ID from JWT app metadata or session claim
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id')::uuid,
    (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid
  );
$$;

-- Verify organization membership and role clearance
CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND (
        role = _required_role
        OR (_required_role = 'hr_manager' AND role = 'org_admin')
        OR role = 'super_admin'
      )
  );
$$;
```

### 2. Concrete Multi-Tenant RLS Policy Templates

#### `employees` Table
```sql
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Org Admins & HR Managers: Full management of employees within their organization
CREATE POLICY "employees: tenant staff manage"
ON public.employees
FOR ALL
TO authenticated
USING (
  organization_id = public.current_org_id()
  AND public.has_org_role(organization_id, 'hr_manager')
)
WITH CHECK (
  organization_id = public.current_org_id()
  AND public.has_org_role(organization_id, 'hr_manager')
);

-- Employees: View own profile in active organization
CREATE POLICY "employees: select own"
ON public.employees
FOR SELECT
TO authenticated
USING (
  organization_id = public.current_org_id()
  AND user_id = auth.uid()
);
```

#### `attendance` Table
```sql
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Org Admins & HR Managers: View all attendance within their organization
CREATE POLICY "attendance: tenant staff select"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  organization_id = public.current_org_id()
  AND public.has_org_role(organization_id, 'hr_manager')
);

-- Employees: View only their own attendance
CREATE POLICY "attendance: employee select own"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  organization_id = public.current_org_id()
  AND employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() AND organization_id = public.current_org_id())
);

-- Attendance Creation: Strictly gated to verified employee button actions
CREATE POLICY "attendance: employee insert own verified"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.current_org_id()
  AND employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid() AND organization_id = public.current_org_id())
);
```

