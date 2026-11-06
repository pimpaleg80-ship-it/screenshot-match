# FlowPeople HRMS — Authentication & Authorization Specification

**Auth Provider**: Supabase Auth (GoTrue)  
**Security Standard**: Strict role-based authorization (RBAC) + Stealth Super Admin Challenge Gate  

---

## 1. Authentication Flow

1. **User Sign-In**:
   - Handled via `src/routes/auth.tsx` through `supabase.auth.signInWithPassword()`.
   - On successful sign-in, the auth token is cached and onAuthStateChange propagates the session to the application context.

2. **Session & Profile Hook (`useSession`)**:
   - Located at `src/hooks/use-session.ts`.
   - Features in-memory caching to eliminate redundant waterfalls.
   - Concurrently fetches `employees`, `user_roles`, and `organization_members`.
   - Derives role flags:
     - `isAdmin`: true if user has role `admin`, `org_admin`, or `super_admin`.
     - `isManager`: true if user has role `manager` or `hr_manager`.
     - `isEmployee`: true for employee accounts.
     - `isSuperadmin`: true if employee record has `is_superadmin = true` or `orgRole === 'super_admin'`.

3. **Super Admin Stealth Security Gate**:
   - Route `/superadmin` is gated by a secondary credential verification modal.
   - Users accessing `/superadmin` must enter their password to unlock the workspace for the active browser session (`sessionStorage.getItem("superadmin_unlocked")`).
   - Non-superadmin users are redirected or denied access with security logging.
