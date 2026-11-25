# FlowPeople HRMS — Database Architecture & Schema Specification

**Database Engine**: Supabase PostgreSQL 15+  
**Multi-Tenant Model**: Tenant-discriminated by `organization_id` with Foreign Key Cascades  
**Row-Level Security (RLS)**: Enforced on all public tables with `(select auth.uid())` and `TO authenticated`

---

## 1. Core Schema Entities

### Organizations (`organizations`)

- Primary tenant registry table storing corporate profile, plan tier (`starter`, `pro`, `enterprise`), maximum employee seats, and rolling GPS retention window (default 90 days).
- Backfilled with root organization: `00000000-0000-0000-0000-000000000001` ('Fluxora Technologies').

### Organization Members (`organization_members`)

- Maps `(organization_id, user_id)` to tenant-scoped roles:
  - `super_admin`: Full cluster administrative privileges across organizations.
  - `org_admin`: Full management of the specific tenant organization.
  - `hr_manager`: Management of employee records, shifts, locations, and leave approvals.
  - `employee`: Personal portal operations and attendance recording.

### Work Locations & Geofence Zones (`work_locations`, `geofence_zones`)

- Stores physical office coordinates (latitude, longitude) and circular boundary radius in meters (50m–500m).
- Seeded with default corporate HQ (`Fluxora HQ - Innovation Campus`, 18.5204° N, 73.8567° E, 150m radius).

### Attendance Ledger & Sessions (`attendance`, `attendance_sessions`)

- Captures `check_in`, `check_out`, `check_in_lat`, `check_in_lon`, `check_out_lat`, `check_out_lon`, `work_location_id`, `total_hours`, and `status`.
- Accessible either through `attendance` or the backwards-compatible view `attendance_sessions WITH (security_invoker = true)`.

### Geofence Events (`geofence_events`)

- Temporary rolling 90-day retention table recording boundary transitions (`ENTER`, `EXIT`, `DWELL`) with coordinates and accuracy.

### Shifts (`shifts`, `employee_shift_assignments`)

- Defines work schedules (e.g. `09:00 - 18:00`), grace periods, and employee assignments.

### Attendance Exceptions (`attendance_exceptions`)

- Captures missed checkouts, outside-geofence attempts, late arrivals, and manager regularization status (`pending`, `approved`, `rejected`).

### Monthly Summaries (`attendance_monthly_summaries`)

- Pre-aggregated canonical monthly attendance totals for billing and legal payroll compliance.

### Google Drive Archival (`attendance_archives`, `archive_jobs`, `archive_files`)

- Multi-tenant Google Drive OAuth tokens, monthly batch job runs, and uploaded PDF file records with SHA-256 integrity hashes.
