# 03. Backend Architecture Audit & Target FastAPI Specification

**Target Framework**: Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 / Asyncpg  
**Current Backend State in Repository**: **VERIFIED ABSENT** — No Python FastAPI backend currently exists in the repository.  
**Current Backend Implementation**: Supabase PostgREST (direct client query layer) + PostgreSQL PL/pgSQL RPC Functions + Deno Supabase Edge Functions + Nitro Server Entry (`src/server.ts`).  

---

## 1. Audit of Current Backend Execution Model

Because no Python files exist in the repository, all current backend operations are handled through three disparate layers:

```
[ Browser / Mobile Client ]
       │
       ├─────────────────── Direct PostgREST Queries ──────────────────► [ Supabase Tables (RLS) ]
       │                    (select, insert, update on employees, etc.)
       │
       ├─────────────────── RPC Function Calls ────────────────────────► [ PL/pgSQL Functions ]
       │                    (admin_create_employee,                      (Security Definer)
       │                     superadmin_provision_user, etc.)
       │
       ├─────────────────── HTTP Edge Functions ───────────────────────► [ Deno Edge Functions ]
       │                    (google-drive-upload,                        (Google Drive OAuth,
       │                     google-drive-daily-backup)                   token encryption)
       │
       └─────────────────── SSR / Server Entry ────────────────────────► [ TanStack Start / Nitro ]
                            (src/server.ts)                              (Cloudflare Worker Runtime)
```

### Existing Backend Logic Inventory

#### 1. Supabase Edge Functions (Deno Runtime)
Located in `supabase/functions/`:
- `google-drive-auth-start`: Initiates Google OAuth 2.0 flow with `drive.file` and `userinfo.email` scopes.
- `google-drive-auth-callback`: Exchanges authorization code for tokens, encrypts refresh token with AES-256-GCM via Web Crypto API, and writes to `drive_connection`.
- `google-drive-status`: Checks connection validity and reports whether token has been revoked by Google.
- `google-drive-upload`: Uploads PDF base64 payloads to Google Drive using multipart or resumable upload with 3 exponential backoff retries.
- `google-drive-daily-backup`: Scheduled/manual worker that queries today's attendance, generates a raw text-based PDF in Deno, and uploads it to Drive.
- `seed-demo-users`: Utility function for provisioning initial administrative accounts.

#### 2. PostgreSQL Stored Procedures (PL/pgSQL Functions)
Located in `public` schema:
- `superadmin_provision_user`: Provisions new user in `auth.users`, creates identity in `auth.identities`, sets password hash via `extensions.crypt(..., extensions.gen_salt('bf', 10))`, assigns role, updates or inserts into `employees`, and logs to `audit_logs`.
- `superadmin_reset_user_password`: Updates `auth.users.encrypted_password` with bcrypt hash and logs audit entry.
- `superadmin_toggle_user_status`: Sets `employees.status` and bans/unbans user in `auth.users`.
- `superadmin_set_user_role`: Updates `user_roles` and toggles `employees.is_superadmin`.
- `admin_create_employee`: Admin-facing employee creation with unique employee code generation (`EMP001...`).
- `handle_leave_status_change`: Trigger function that deducts leave days from `leave_balances` when status becomes `approved`, or refunds balance if cancelled.
- `block_overlapping_leave`: Trigger function preventing overlapping approved or pending leave dates for the same employee.
- `notify_on_leave_apply` & `notify_on_leave_decision`: Trigger functions inserting alerts into `notifications`.

---

## 2. Identified Deficiencies of Current Backend Model

1. **Tight Client-to-Database Coupling**:
   - The React frontend directly crafts SQL-like queries (`supabase.from("attendance").select(...)`).
   - Business rules (e.g., late grace periods, overtime calculations, duplicate scan timeouts) are calculated in client-side TypeScript code (`src/lib/attendance.ts`, `src/routes/_authenticated/kiosk.tsx`).
   - An authenticated user can bypass UI logic and submit arbitrary attendance timestamps directly via PostgREST unless blocked by custom RLS check constraints.

2. **Absence of Server-Side Geofence Validation**:
   - The current database schema contains no GPS coordinates, work location radius, or geofence boundary polygons.
   - There is no backend service to independently verify whether a mobile check-in coordinates fall within an assigned office polygon.

3. **No Rate Limiting or Request Throttling**:
   - PostgREST exposes direct REST endpoints without IP-based or user-based rate limiting.
   - Repeated heavy aggregation queries on `/reports` can exhaust PostgreSQL connection pools on the Supabase Free tier.

4. **Scattered Audit & Security Logging**:
   - Audit logs are manually inserted in some RPC functions, but standard table inserts/updates via PostgREST generate no audit trail unless explicit database triggers are configured.

---

## 3. Recommended Target Python FastAPI Architecture

To meet the production multi-tenant requirements, all business logic, geofence verification, shift calculations, and PDF generation must be centralized into a dedicated Python FastAPI service.

### Target Directory Structure
```
backend/
├── app/
│   ├── main.py                     # FastAPI application factory, CORS, exception handlers
│   ├── config.py                   # Pydantic Settings (Supabase credentials, JWT secrets, Google keys)
│   ├── core/
│   │   ├── security.py             # Supabase JWT decoding, JWKS caching, password utils
│   │   ├── dependencies.py         # Auth dependency, current_user, current_tenant
│   │   ├── database.py             # Async SQLAlchemy engine & session maker
│   │   └── exceptions.py           # Standard HTTP & Domain exceptions
│   ├── middlewares/
│   │   ├── tenant_middleware.py    # X-Organization-ID resolution & validation
│   │   └── logging_middleware.py   # Request ID, performance metrics, and audit logging
│   ├── api/
│   │   └── v1/
│   │       ├── api.py              # Main router aggregation
│   │       ├── auth.py             # Login verification, profile retrieval, tenant switching
│   │       ├── organizations.py    # Multi-tenant organization CRUD, settings, branding
│   │       ├── locations.py        # Work locations, geofences, employee assignments
│   │       ├── attendance.py       # Check-in, check-out, sessions, regularizations
│   │       ├── leaves.py           # Quotas, balances, requests, multi-tier approvals
│   │       ├── employees.py        # Employee directory, device registration
│   │       ├── reports.py          # Monthly attendance summaries, analytics
│   │       └── archives.py         # Google Drive OAuth, PDF batch trigger, manifests
│   ├── models/                     # SQLAlchemy 2.0 declarative database models
│   ├── schemas/                    # Pydantic v2 validation models
│   ├── services/
│   │   ├── geofence_service.py     # Haversine & Ray-Casting polygon geofence algorithms
│   │   ├── attendance_service.py   # State machine, shift calculations, grace periods
│   │   ├── leave_service.py        # Working days calculation, balance deduction
│   │   ├── pdf_service.py          # ReportLab / WeasyPrint monthly PDF generation
│   │   └── drive_service.py        # Google Drive API v3 client, OAuth token management
│   └── tasks/
│       ├── daily_sync.py           # End-of-day attendance closure worker
│       ├── retention_cleanup.py    # 90-day temporary GPS log cleanup worker
│       └── monthly_archive.py      # Monthly PDF compilation and Drive upload job
├── tests/
└── Dockerfile
```

---

## 4. Target API Router & Endpoint Inventory

### Authentication & Tenant Context (`/api/v1/auth`)
- `GET /me`: Returns authenticated user identity, assigned organizations, active organization context, and roles.
- `POST /switch-organization`: Switches active organization context and issues scoped tenant token.

### Organizations & Locations (`/api/v1/organizations`, `/api/v1/locations`)
- `GET /organizations`: List organizations (Super Admin sees all; users see member organizations).
- `POST /organizations`: Provision new tenant organization with isolated schema/tables.
- `GET /locations`: List active office locations and geofence polygons for the active organization.
- `POST /locations`: Create office location with latitude, longitude, radius (meters), and optional polygon boundaries.
- `PUT /locations/{id}`: Update office location coordinates or geofence boundary.
- `POST /locations/{id}/assign-employees`: Assign personnel to specific office locations.

### Attendance Engine (`/api/v1/attendance`)
- `POST /verify-location`: Receives mobile GPS coordinate `(lat, lon, accuracy, device_id)` and evaluates geofence zone. Returns `{ eligible_for_checkin: bool, eligible_for_checkout: bool, location_id: uuid }`. **Crucial**: Does NOT mark attendance.
- `POST /check-in`: Authenticated employee manual action. Re-evaluates live GPS location against assigned geofence, verifies device ID, checks active shift, and creates an `attendance_session` record.
- `POST /check-out`: Authenticated employee manual action. Re-evaluates live GPS location. **Strictly disabled** if employee is outside the assigned geofence zone. Calculates total session hours.
- `GET /today`: Returns employee's real-time attendance session status, geofence eligibility, and shift schedule.
- `GET /records`: Filterable attendance roster with date range, department, and status filters.
- `POST /regularize`: Employee regularization request for missed punches or off-site duties with mandatory manager approval.

### Archival & Retention (`/api/v1/archives`)
- `POST /google-drive/connect`: Generates organization-scoped OAuth 2.0 authorization URL.
- `GET /google-drive/callback`: Handles OAuth redirect, stores encrypted refresh token in `attendance_archives`.
- `POST /generate-monthly-pdf`: Triggers background compilation of employee-wise and organization-wise PDF reports.
- `POST /run-retention-cleanup`: Executes rolling 90-day cleanup of temporary GPS verification logs after confirming archive integrity.

