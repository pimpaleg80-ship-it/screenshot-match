# 10. Phase 2 Implementation Roadmap, Retention & Supabase Free Optimization

**Goal**: Seamless, Non-Destructive SaaS Upgrade from Phase 1 Audit to Production Multi-Tenant Platform  
**Target Deployment**: Initial 25-Employee Production Pilot on Supabase Free Tier  
**Execution Condition**: STRICT STOP — Awaiting explicit user approval before beginning any Phase 2 implementation.

---

## 1. Data Retention & Supabase Free Tier Optimization

### 1. Rolling 90-Day Temporary GPS Log Retention Strategy

To protect employee privacy and optimize storage on the Supabase Free Tier:

- **Temporary Entity**: Raw GPS coordinates and background geofence transition logs (`geofence_events`, `location_verification_logs`) are retained for **90 days by default** (configurable per organization in `organizations.gps_retention_days`).
- **Canonical Permanence**: **Canonical attendance records (`attendance_sessions` and `attendance_monthly_summaries`) are NEVER deleted.** They constitute legal payroll and compliance history.
- **Safety Gate Verification**: Before any historical month's raw GPS events are purged, the cleanup worker verifies that `archive_jobs` has an entry with `status = 'completed'` and verified Google Drive hashes for that specific month.
- **Safe Batch Purge Worker**:
  ```sql
  -- Automated batch purge query executed monthly by background worker
  DELETE FROM public.geofence_events
  WHERE recorded_at < now() - interval '90 days'
    AND organization_id IN (
      SELECT organization_id FROM public.archive_jobs
      WHERE status = 'completed'
        AND (year || '-' || lpad(month::text, 2, '0')) < to_char(now() - interval '90 days', 'YYYY-MM')
    );
  ```

### 2. Supabase Free Tier Capacity & Resource Sizing (25-Employee Deployment)

| Resource Metric                | Supabase Free Tier Quota | Monthly Consumption (25 Employees)             | Annual Consumption | Free Tier Utilization %   |
| ------------------------------ | ------------------------ | ---------------------------------------------- | ------------------ | ------------------------- |
| **Database Storage**           | 500 MB                   | ~1.5 MB / month                                | ~18 MB / year      | **< 4% of quota**         |
| **Monthly Active Users (MAU)** | 50,000 MAU               | 25 MAU                                         | 25 MAU             | **0.05% of quota**        |
| **Database Connections**       | 60 direct / 200 pooler   | 10–15 concurrent (via FastAPI connection pool) | Constant           | **< 10% of quota**        |
| **Edge Function Invocations**  | 500,000 / month          | ~3,000 / month (or 0 if FastAPI hosts Drive)   | ~36,000 / year     | **< 1% of quota**         |
| **File Storage Bucket**        | 1,000 MB                 | ~5 MB (employee profile photos only)           | ~15 MB             | **< 2% of quota**         |
| **Google Drive PDF Storage**   | Unlimited (Target Drive) | ~30 MB / month (25 employee PDFs + Master)     | ~360 MB / year     | **0% impact on Supabase** |

_Conclusion_: The Supabase Free tier provides ample headroom for an initial 25-employee deployment, supporting up to 500 active employees before requiring a database compute upgrade.

---

## 2. Phase 2 Implementation Roadmap (Milestones)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PHASE 2 IMPLEMENTATION ROADMAP                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  MILESTONE 1: Multi-Tenant Database Migration & Data Backfill               │
│  • Create organizations, organization_members, work_locations tables        │
│  • Backfill existing records into "Default Initial Organization"             │
│  • Upgrade RLS policies with tenant isolation                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  MILESTONE 2: Python FastAPI Backend Service Implementation                 │
│  • Scaffold FastAPI project with Pydantic v2 & Async SQLAlchemy             │
│  • Implement JWT authentication, tenant middleware, and RBAC guards         │
│  • Build location verification, manual check-in/out, and shift engines      │
├─────────────────────────────────────────────────────────────────────────────┤
│  MILESTONE 3: Frontend Geofence Integration & Action Center                 │
│  • Add live [ Check-in ] & [ Check-out ] buttons on Employee Dashboard      │
│  • Integrate real-time geofence eligibility indicators and branch pickers   │
│  • Add Work Locations & Geofence management studio in Admin Settings        │
├─────────────────────────────────────────────────────────────────────────────┤
│  MILESTONE 4: Capacitor Mobile Application (Android & iOS)                  │
│  • Scaffold Capacitor project with native Android and iOS targets           │
│  • Implement Android GeofencingClient and BootCompletedReceiver             │
│  • Implement iOS Core Location region monitoring & background lifecycle     │
├─────────────────────────────────────────────────────────────────────────────┤
│  MILESTONE 5: Automated Monthly Archival & 90-Day Retention Worker          │
│  • Multi-tenant Google Drive OAuth integration in FastAPI                   │
│  • ReportLab / WeasyPrint monthly PDF generator (Employee + Master Org)     │
│  • Verified upload pipeline with SHA-256 manifests and rolling GPS cleanup  │
├─────────────────────────────────────────────────────────────────────────────┤
│  MILESTONE 6: End-to-End Regression Testing, Security Audit & Deployment    │
│  • Unit & Integration test coverage for geofencing, shifts, and attendance  │
│  • Cross-tenant penetration testing (verifying zero data leakage)           │
│  • Production rollout and pilot validation with 25 employees                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Non-Destructive Data Migration & Backfill Strategy

To preserve all working data without data loss during Milestone 1:

1. **Create `organizations`** table.
2. **Insert Root Tenant**:
   ```sql
   INSERT INTO public.organizations (id, slug, name, plan_tier, max_employees)
   VALUES ('00000000-0000-0000-0000-000000000001', 'fluxora-default', 'FlowPeople Primary Organization', 'enterprise', 100);
   ```
3. **Add `organization_id` Column to Existing Tables**:
   Add `organization_id uuid REFERENCES public.organizations(id)` as nullable first.
4. **Backfill Existing Records**:
   ```sql
   UPDATE public.employees SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
   UPDATE public.departments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
   UPDATE public.attendance SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
   UPDATE public.leave_requests SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
   UPDATE public.leave_balances SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
   UPDATE public.leave_types SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
   UPDATE public.holidays SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
   UPDATE public.documents SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
   UPDATE public.announcements SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
   ```
5. **Backfill `organization_members`**:
   Populate `organization_members` from existing `user_roles` linking all current users to `'00000000-0000-0000-0000-000000000001'`.
6. **Set `NOT NULL` Constraints**:
   Enforce `organization_id NOT NULL` only after verified backfill.

---

## 4. Risk Matrix & Rollback Safeguards

| Risk Description                    | Severity | Preventative Mitigation                                                                                                                                  | Rollback Plan                                                                                    |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **RLS Policy Lockout**              | High     | Test all rewritten policies in a separate transaction block with role impersonation (`SET LOCAL ROLE`) before committing.                                | Revert to previous RLS policies stored in migration backup scripts.                              |
| **Mobile Geofence Battery Drain**   | Medium   | Use OS hardware-assisted geofencing (`GeofencingClient` / `CLCircularRegion`) rather than continuous GPS polling. Clamp minimum radius to $100\text{m}$. | Adjust loitering delays and notification responsiveness in location settings.                    |
| **GPS Spoofing / Mock Locations**   | High     | Reject any payload where `is_mock_location == true` or horizontal accuracy $> 30\text{m}$. Enforce hardware device registration.                         | Flag suspicious records into `attendance_exceptions` for manual manager review.                  |
| **Google Drive Quota / Rate Limit** | Low      | Implement exponential backoff retries with jitter and batch file pacing (max 2 uploads per second).                                                      | Failed uploads are logged in `archive_files` with `status = 'failed'` and retried automatically. |

---

## 5. Phase 1 Completion & Sign-off

Phase 1 audit and architectural planning is complete.

**Execution Status**: STOPPED per instructions. No source files or database schemas were modified. Awaiting explicit user approval before beginning Phase 2 implementation.
