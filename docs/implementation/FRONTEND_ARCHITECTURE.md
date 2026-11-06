# FlowPeople HRMS — Frontend Architecture Specification

**Framework**: React 19 + TanStack Start (Nitro SSR / SPA hybrid) + Vite  
**Routing**: TanStack Router (File-based routing with route tree generation)  
**State & Data Fetching**: TanStack React Query v5 + Client-side Fast In-Memory Session Cache  
**UI & Styling**: Tailwind CSS, Radix UI primitives, Lucide React, Recharts

---

## 1. Route Inventory & Component Hierarchy

| Route Path                   | Access Role              | Component File                             | Key Features                                                                                    |
| ---------------------------- | ------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `/`                          | Public / Redirect        | `src/routes/index.tsx`                     | Landing redirect to authenticated dashboard or login                                            |
| `/auth`                      | Public                   | `src/routes/auth.tsx`                      | Multi-role email/password authentication & session initialization                               |
| `/reset-password`            | Public                   | `src/routes/reset-password.tsx`            | Secure password recovery workflow                                                               |
| `/_authenticated/dashboard`  | All Roles                | `src/routes/_authenticated/dashboard.tsx`  | Role-differentiated dashboard (Admin, Manager, Employee) with Geofence Attendance Action Center |
| `/_authenticated/people`     | Admin, Manager           | `src/routes/_authenticated/people.tsx`     | Employee directory, profile creation, and department assignment                                 |
| `/_authenticated/attendance` | Admin, Manager, Employee | `src/routes/_authenticated/attendance.tsx` | Complete attendance audit ledger, CSV/PDF export, realtime sync                                 |
| `/_authenticated/leaves`     | All Roles                | `src/routes/_authenticated/leaves.tsx`     | Leave quota management, request submission, two-tier approval workflow                          |
| `/_authenticated/reports`    | Admin, Manager           | `src/routes/_authenticated/reports.tsx`    | Punctuality metrics, working hour distributions, department trends                              |
| `/_authenticated/settings`   | Admin                    | `src/routes/_authenticated/settings.tsx`   | Operating hours, Work Locations & Geofence Boundaries, Google Drive cloud backups               |
| `/_authenticated/kiosk`      | Admin, Kiosk             | `src/routes/_authenticated/kiosk.tsx`      | Dedicated tablet facial recognition kiosk with dual-scan debouncing                             |
| `/_authenticated/superadmin` | Super Admin              | `src/routes/_authenticated/superadmin.tsx` | Multi-Tenant Organizations & Subscriptions Studio, System Roles, Security Audit Ledger          |

---

## 2. Geofence Attendance Center Integration

The Employee Dashboard (`/_authenticated/dashboard`) features the **`GeofenceAttendanceCard`** (`src/components/geofence-attendance-card.tsx`):

- Queries current GPS coordinates via `getCurrentDevicePosition()` (supporting HTML5 Geolocation and Capacitor Native Geolocation).
- Computes Haversine distance to the employee's assigned `work_locations`.
- Enforces physical presence:
  - **Check-in Button**: Disabled when outside geofence. Enabled with green status when inside ($d \le \text{radius}$).
  - **Check-out Button**: Disabled when outside geofence. Enabled only when checked-in and physically on-site.
  - **Regularization Modal**: Allows submitting attendance exception requests for missed check-out or off-site assignments.
