# 02. Frontend Architecture Audit & Route Inventory

**Application**: FlowPeople Web Client  
**Framework Stack**: React 19.2.0, Vite 8.1.5, TanStack Router 1.170.41, TanStack Start 1.168.60, Tailwind CSS 4.2.1, Radix UI  
**Audit Scope**: Complete frontend codebase (`src/routes`, `src/components`, `src/hooks`, `src/lib`, `src/integrations`)  

---

## 1. Complete Route Inventory

Every route defined in the file-based TanStack Router tree has been audited. Below is the comprehensive route roster:

| Route Path | Allowed Roles | Component / Source File | API & Database Dependencies | Current Functionality | Identified Issues & Limitations | Recommended Phase 2 Improvements |
|---|---|---|---|---|---|---|
| `/` | Public | `src/routes/index.tsx` | Supabase Auth (`getSession`) | Root landing router. Redirects authenticated users to `/dashboard` and unauthenticated to `/auth`. | Full-page reload / flash if session is slow. | Implement optimistic cached session hydration in router loader. |
| `/auth` | Public / Anonymous | `src/routes/auth.tsx` | `supabase.auth.signInWithPassword`, `signUp`, `resetPasswordForEmail` | Tabbed authentication hub (Sign In, Sign Up, Forgot Password). Responsive card with validation. | Direct signup assigns default `employee` role without organization selection. | Integrate organization subdomain / slug detection or invite token verification. |
| `/login` | Public | `src/routes/login.tsx` | N/A | Alias redirect to `/auth`. | Redundant route alias. | Retain as 301/permanent redirect for backwards compatibility. |
| `/signin` | Public | `src/routes/signin.tsx` | N/A | Alias redirect to `/auth`. | Redundant route alias. | Retain as 301/permanent redirect. |
| `/reset-password` | Public / Token holder | `src/routes/reset-password.tsx` | `supabase.auth.updateUser` | Password recovery form with OTP / access token verification. | No password strength meter or zxcvbn evaluation. | Add real-time password complexity and policy enforcement. |
| `/_authenticated` | Authenticated users | `src/routes/_authenticated.tsx` | `useSession()`, `supabase.auth` | Root layout wrapper for authenticated views. Injects `AppLayout`, mobile navigation drawer, and theme provider. | Client-side auth redirect can cause brief layout flickers. | Enforce server-side session cookies via `@supabase/ssr` / Nitro. |
| `/dashboard` | All authenticated (`employee`, `manager`, `admin`, `superadmin`) | `src/routes/_authenticated/dashboard.tsx` | `attendance`, `employees`, `departments`, `leave_balances`, `holidays`, `audit_logs` | Executive, Manager, and Employee personalized dashboards. Displays live biometric feed, recent activity, leave quotas, and work hours. | **No manual Check-in/Check-out buttons** for employees. Relies on Kiosk or Admin manual entry. | **Add Geofence-Aware Manual Check-In/Check-Out Action Center** for mobile employees. |
| `/people` | `admin`, `manager`, `superadmin` | `src/routes/_authenticated/people.tsx` | `employees`, `departments`, `face_data`, `user_roles`, `admin_create_employee` | Personnel directory with search, department filtering, employee creation modal, and web camera face enrollment dialog. | Modifying employee records currently queries single-tenant `employees` without organization constraints. | Scope all queries by `organization_id`; add location assignment picker. |
| `/attendance` | `admin`, `manager`, `superadmin` (read own for `employee`) | `src/routes/_authenticated/attendance.tsx` | `attendance`, `employees`, `departments`, `generateAndBackupPdf`, `exportCsv` | Daily attendance audit log, status indicators, manual check-in/out modal, CSV export, and Google Drive PDF sync. | Manual entry allows arbitrary timestamps without GPS coordinates or location audit trail. | Require geofence verification tag, device ID, and HR justification for regularizations. |
| `/leaves` | All authenticated | `src/routes/_authenticated/leaves.tsx` | `leave_requests`, `leave_balances`, `leave_types`, `employees`, `holidays` | Leave management portal: quota cards, request submission with working-day calculation, approval/rejection modal, and direct balance grants. | Leave types are shared globally across all companies; no organization-specific leave policies. | Associate `leave_types` and `leave_balances` with specific organizations. |
| `/reports` | `admin`, `manager`, `superadmin` | `src/routes/_authenticated/reports.tsx` | `attendance`, `employees`, `departments`, Recharts, `generateAndBackupPdf` | Analytics studio: presence rates, late trends, department breakdown charts, and monthly PDF export with Google Drive backup. | Client-side aggregation of raw records; unscalable for > 500 employees. | Move heavy aggregation and PDF generation to background FastAPI workers. |
| `/settings` | `admin`, `superadmin` | `src/routes/_authenticated/settings.tsx` | `settings`, `drive_connection`, `drive_backups`, `holidays`, `user_roles`, Edge Functions | Organization configuration, working shifts, late grace minutes, Google Drive OAuth connection, backup history, and holidays. | Single-row `settings` and `drive_connection` tables; any change affects entire database. | Migrate settings and Drive tokens to per-organization records. |
| `/superadmin` | `superadmin` only | `src/routes/_authenticated/superadmin.tsx` | `employees`, `user_roles`, `audit_logs`, `settings`, `superadmin_provision_user`, `superadmin_reset_user_password` | Root system console protected by credential gate. Displays system metrics, user roster, user provisioning studio, password reset, and audit logs. | Missing Organization Management studio, tenant onboarding, and billing management. | Add multi-tenant organization manager, subscription tier controls, and tenant switcher. |
| `/holidays` | All authenticated (`admin` writes) | `src/routes/_authenticated/holidays.tsx` | `holidays`, `useSession()` | Calendar and list view of official company holidays; modal for adding new holidays. | Holidays are global and cannot be assigned per office location or region. | Add `work_location_id` to support location-specific public holidays. |
| `/documents` | All authenticated (`admin`/`manager` writes) | `src/routes/_authenticated/documents.tsx` | `documents`, Supabase Storage (`documents` bucket) | Company policies and documents library with file upload or Google Drive link integration. | Documents are not categorized by department or tenant organization. | Add organization scoping and role-based document access controls. |
| `/announcements` | All authenticated (`admin`/`manager` writes) | `src/routes/_authenticated/announcements.tsx` | `announcements`, `departments`, `employees` | Broadcast messaging center targeting All, Department, or Selected personnel with optional expiry dates. | Announcement records lack organization scoping. | Scope announcements by `organization_id` and add push notification dispatch. |
| `/profile` | All authenticated | `src/routes/_authenticated/profile.tsx` | `employees`, `supabase.auth.updateUser` | Self-service user profile: view role, department, employee code, update phone number, and change password. | Cannot update home address or view assigned work location. | Display assigned geofence zone, registered device status, and shift timings. |
| `/kiosk` | Dedicated terminal / `admin` / `superadmin` | `src/routes/_authenticated/kiosk.tsx` | `@vladmandic/face-api`, `face_data`, `attendance`, `settings`, HTML5 Web Audio | Smart Kiosk terminal for continuous hands-free facial recognition check-in/out with 2.5-minute auto debounce. | Camera and neural net runs in browser; incompatible with mobile background operation. | Retain as secondary office tablet terminal; mobile app will use GPS manual buttons. |
| `/enroll` | `admin`, `manager`, `superadmin` | `src/routes/_authenticated/enroll.tsx` | `@vladmandic/face-api`, `face_data`, `employees` | Standalone biometric enrollment station. Captures webcam frames, computes 128-d descriptor, and saves to `face_data`. | Generates heavy client-side CPU load on low-end laptops. | Retain web enrollment while adding mobile photo upload + server validation option. |

---

## 2. Frontend Architecture & Component Hierarchy

### Component Architecture
- **Root Layout (`src/routes/__root.tsx`)**: Initializes `QueryClient`, `TooltipProvider`, `Toaster` (Sonner), and TanStack Router error boundaries.
- **Application Shell (`src/components/app-layout.tsx`)**:
  - **Desktop View (`md:block`)**: 64px fixed left sidebar featuring brand logo, icon navigation roster with active route highlight, collapse toggle, and user profile popover.
  - **Mobile View (`md:hidden`)**: Compact 56px sticky top navigation bar with enlarged brand logo, connection status indicator, and a hamburger button triggering a full-featured slide-in drawer (`Sheet`).
  - **Mobile Drawer**: Hosts the complete 13-route navigation hierarchy with accessible $\ge 44\text{px}$ touch targets, active state badges, user clearance card, and automatic closing upon route change.
- **Branding Component (`src/components/brand-logo.tsx`)**: Scaled vector logo maintaining strict aspect ratios across breakpoints (`sm:h-9`, `md:h-11`, `lg:h-14`, `xl:h-18`).

### State Management & Data Fetching
- **Server Cache**: Powered by `@tanstack/react-query` v5 with dedicated query keys (`attendance-records`, `employee-leaves`, `kiosk-enrolled-descriptors`, `superadmin-users`).
- **Session & Identity Cache (`src/hooks/use-session.ts`)**:
  - Implements an in-memory module-level singleton (`globalSession`, `globalProfile`, `profileInFlight`) to eliminate waterfall latency when navigating between pages.
  - Subscribes to `supabase.auth.onAuthStateChange` to automatically synchronize login, logout, and token refresh events across tabs.
- **Form State**: Managed via `react-hook-form` with `zod` schemas and `sonner` toast notifications for validation errors.

---

## 3. Responsive Design Audit

The frontend was comprehensively audited across six standard responsive breakpoints:
1. **Mobile Phones (320px–480px)**:
   - Tables on `/attendance`, `/leaves`, `/reports`, and `/superadmin` use container-wrapped horizontal scrolling with explicit minimum widths (`min-w-[700px]` to `min-w-[760px]`) to prevent table cell collapse.
   - KPI metrics collapse into 1-column or 2-column grids (`grid-cols-1 sm:grid-cols-2`).
   - Dialog modals use dynamic mobile dimensions: `w-[95vw] max-h-[90vh] overflow-y-auto` to prevent mobile virtual keyboards from obscuring action buttons.
2. **Large Mobile & Tablets (480px–1024px)**:
   - Adaptive 2-to-3 column layouts for People directory and Leave balance cards.
   - Quick Action bars wrap cleanly into multi-column touch buttons.
3. **Laptops & Large Displays (1024px–1920px+)**:
   - Sidebar docks into full-height navigation rail.
   - Max-width containers (`max-w-7xl` and `max-w-5xl`) prevent excessive horizontal spreading on ultra-wide monitors.

---

## 4. Mobile & Capacitor Readiness Assessment

1. **Current Hybrid Status**:
   - The application is currently packaged as a pure Progressive Web App / SSR web bundle.
   - No Capacitor configuration (`capacitor.config.ts`) or native Android/iOS platform folders currently exist in the repository.
2. **Capacitor Compatibility Strengths**:
   - Clean separation of client logic and browser DOM.
   - Tailwind CSS touch targets are compliant with iOS Human Interface Guidelines and Android Material Design ($\ge 44\text{px} \times 44\text{px}$).
   - Client routing via TanStack Router supports client-side SPA navigation required for native mobile runtimes.
3. **Architectural Blockers for Native Mobile**:
   - `window.open` calls in `src/lib/attendance.ts` (table printing) must be replaced with native share/file viewers.
   - Client-side `@vladmandic/face-api` requires active WebGL and camera streams that consume significant mobile battery; native background attendance must rely strictly on GPS and geofences rather than continuous camera loops.
   - Lack of Capacitor native plugin bridges for `@capacitor/geolocation` and native background geofencing services.

