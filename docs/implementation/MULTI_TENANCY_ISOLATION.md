# FlowPeople HRMS — Multi-Tenancy & Tenant Isolation Architecture

**Pattern**: Pooled Multi-Tenancy with Tenant-Discriminated Row-Level Security  
**Tenant Identifier**: `organization_id (uuid)`

---

## 1. Isolation Mechanism

Every multi-tenant entity contains an `organization_id` foreign key referencing `public.organizations(id)`:

- `employees`
- `departments`
- `work_locations`
- `shifts`
- `attendance` / `attendance_sessions`
- `leave_requests`
- `leave_balances`
- `leave_types`
- `holidays`
- `documents`
- `announcements`
- `settings`
- `audit_logs`
- `geofence_events`
- `attendance_exceptions`
- `attendance_monthly_summaries`
- `attendance_archives`
- `archive_jobs`
- `archive_files`

---

## 2. PostgreSQL Context Functions

1. `public.current_org_id()`:
   - Evaluates the authenticated user's active membership in `organization_members`.
   - Returns the tenant `organization_id` for use in RLS policies and queries.

2. `public.has_org_role(required_role text)`:
   - Validates if the authenticated caller has the necessary permission level within their organization.
   - Enforces the role hierarchy: `super_admin > org_admin > hr_manager > employee`.

---

## 3. Row-Level Security Policies

- **Select Operations**: Constrained to records where `organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid()))` or caller is a verified `super_admin`.
- **Insert/Update/Delete Operations**: Restricted to organization administrators (`role IN ('super_admin', 'org_admin')`).
