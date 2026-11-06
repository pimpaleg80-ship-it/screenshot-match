# 01. FlowPeople HRMS — Phase 1 Architecture Audit: Executive Summary

**Project**: FlowPeople HRMS (by Fluxora)  
**Repository**: `pimpaleg80-ship-it/screenshot-match`  
**Audit Date**: November 6, 2026  
**Auditor Role**: Principal Software Architect, Senior React Engineer, FastAPI Backend Architect, Supabase Database Architect, and SaaS Security Auditor  
**Phase**: Phase 1 — Read-Only Architecture Audit & Target Specification  
**Status**: READ-ONLY AUDIT COMPLETE — Awaiting approval for Phase 2 implementation

---

## 1. Executive Overview & Context

FlowPeople is an enterprise Human Resource Management System (HRMS) developed initially with React 19, Vite, TanStack Router/Start, and Supabase PostgreSQL. The platform currently manages personnel records, biometric face-recognition check-in/out, leave requests, company announcements, policy documents, and automated Google Drive cloud backups.

This comprehensive audit evaluates the existing codebase against the target production-grade SaaS architecture:

1. **Multi-Tenant SaaS Foundation**: Moving from the current single-tenant database to a multi-tenant architecture supporting Super Admin, Organization Admin, HR Manager, and Employee roles.
2. **Multiple Office Locations & Native Geofencing**: Supporting multiple office branches per organization, where native mobile geofencing controls manual Check-in and Check-out button eligibility without automatic clock-in.
3. **Dedicated Python FastAPI Backend**: Consolidating business logic, authorization, shift rules, and PDF aggregation into a secure, decoupled FastAPI backend.
4. **Capacitor Mobile Deployment**: Providing native Android (Geofencing API) and iOS (Core Location) mobile apps alongside the responsive web portal.
5. **Archival & Retention**: Automated monthly employee and organization PDF generation, verified Google Drive archival, and rolling 90-day temporary GPS log cleanup optimized for the Supabase Free tier.

---

## 2. Key Audit Statistics & Verified Findings

| Audit Dimension                       | Metric / Count                                                               | Status / Verification                                            |
| ------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Total Frontend Routes Audited**     | **17 Routes** (4 Public, 13 Authenticated)                                   | Verified in `src/routes/` & `src/routeTree.gen.ts`               |
| **Existing Python FastAPI Endpoints** | **0 Endpoints (Not Present)**                                                | **VERIFIED ABSENT** — No Python code exists in the repository    |
| **Existing Supabase Edge Functions**  | **6 Edge Functions**                                                         | Verified in `supabase/functions/` (Google Drive & Seed)          |
| **Live Supabase Tables Inspected**    | **16 Relational Tables**                                                     | Verified live via PostgreSQL connection (`mnnecoyqofhrivxufhqm`) |
| **Live Database Views**               | **2 Views** (`people`, `face_descriptors`)                                   | Verified live with `INSTEAD OF` triggers                         |
| **Live Database Functions**           | **19 PL/pgSQL Functions**                                                    | Verified live in `public` schema                                 |
| **Live Database Triggers**            | **10 Triggers**                                                              | Verified live across tables and views                            |
| **Live RLS Policies**                 | **39 RLS Policies** (100% of tables have RLS enabled)                        | Verified live in `pg_policies`                                   |
| **Storage Buckets**                   | **4 Buckets** (`leave-attachments`, `documents`, `announcements`, `avatars`) | Verified live in `storage.buckets`                               |
| **Current Multi-Tenant Isolation**    | **0% (Completely Single-Tenant)**                                            | **CRITICAL FINDING**: 0 tables have `organization_id`            |
| **Current Geofencing Support**        | **0% (Not Present)**                                                         | Attendance currently uses biometric kiosk or manual HR dialog    |

---

## 3. Verified Architecture vs. Confirmed Target Matrix

| Requirement / Component   | Current State in Repository                                                            | Confirmed Target Architecture                                                                                      | Gap / Action Required                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Multi-Tenancy**         | Single-tenant database; no `organizations` or `organization_members` tables.           | Strict multi-tenant isolation across all entities with tenant-scoped RLS and JWT tenant claims.                    | Major schema migration to add `organizations` and foreign keys to all business entities.                      |
| **Roles & Permissions**   | 3 enum roles (`admin`, `manager`, `employee`) + `is_superadmin` column in `employees`. | 4 standard SaaS roles: Super Admin, Organization Admin, HR Manager, Employee.                                      | Update role model; decouple global Superadmin from organization-level admin/HR roles.                         |
| **Backend Layer**         | Direct client-to-Supabase PostgREST calls + PL/pgSQL RPCs + TanStack Start Nitro SSR.  | Dedicated Python FastAPI backend service handling authentication verification, attendance logic, and aggregation.  | Design and scaffold complete FastAPI application in Phase 2.                                                  |
| **Office Locations**      | No concept of locations or branches; single company profile in `settings`.             | Multiple office locations per organization with GPS coordinates, radius, and polygon geofences.                    | Create `work_locations`, `geofence_zones`, and `employee_location_assignments` entities.                      |
| **Attendance Mechanism**  | Biometric facial recognition kiosk auto-marking or HR manual modal entry.              | Location-based manual attendance: GPS controls button eligibility only; manual press mandatory.                    | Implement mobile/web geofence validation and manual button flow; preserve kiosk as secondary check-in method. |
| **Mobile App**            | Responsive web application running in browser; no native wrappers.                     | Hybrid mobile application using Capacitor with background native geofencing plugins.                               | Scaffold Capacitor project; configure Android Foreground Service and iOS Core Location lifecycle.             |
| **Google Drive Archival** | Working Edge Function single-tenant OAuth flow; single-row `drive_connection` table.   | Multi-tenant organization-level Drive integration; monthly automated employee and master PDF generation.           | Migrate `drive_connection` and `drive_backups` to include `organization_id`; automate monthly batch worker.   |
| **Data Retention**        | Static setting `retention_days = 365` in `settings`; no automatic cleanup cron.        | Configurable 90-day retention on temporary GPS/geofence logs; permanent storage of canonical attendance summaries. | Implement automated pg_cron / FastAPI cleanup worker with archive verification gates.                         |

---

## 4. Critical Architecture & Security Findings

1. **Absence of Organization Scoping (Data Leakage Risk)**:
   - None of the 16 existing database tables contain an `organization_id` or `tenant_id` column.
   - Any administrator authenticated in the current system has full visibility into all employee rows, attendance records, leave balances, and audit logs across the entire database.
   - The Google Drive connection (`drive_connection`) is a single-row singleton; connecting an account binds the entire system to one Google Drive.

2. **Backend Execution Model Discrepancy**:
   - The user specification referenced a Python FastAPI backend. However, forensic inspection confirms that **no Python files exist in the repository** (aside from a utility in `node_modules`).
   - The existing architecture is a serverless JAMstack / TanStack Start application where the browser communicates directly with Supabase via `@supabase/supabase-js` and Supabase Edge Functions in Deno.
   - Moving to a FastAPI backend will centralize business logic, prevent sensitive database logic exposure, and decouple client applications from raw database access.

3. **Attendance Philosophy Paradigm Shift**:
   - The existing system was built around facial recognition biometric terminals (`src/routes/_authenticated/kiosk.tsx`) with automatic check-in/check-out upon face detection.
   - The confirmed product requirement strictly dictates **no automatic attendance marking**: GPS must only control button eligibility, and employees must manually initiate both check-in and check-out.

4. **Biometric Data Storage**:
   - 128-dimensional facial embeddings are stored as JSON arrays in `face_data.descriptor`. While protected by RLS (`admin only`), these vectors should be scoped per organization and sanitized from general API responses.

---

## 5. Phase 1 Documentation Inventory

The following 10 exhaustive audit and architecture specification documents have been generated in `docs/architecture/`:

1. [`01_EXECUTIVE_SUMMARY.md`](<file:///f:/New%20folder%20(3)/docs/architecture/01_EXECUTIVE_SUMMARY.md>): Executive overview, verified metrics, audit summary, and core risk register.
2. [`02_FRONTEND_AUDIT.md`](<file:///f:/New%20folder%20(3)/docs/architecture/02_FRONTEND_AUDIT.md>): Complete route inventory, component hierarchy, state management, form validation, and responsive mobile readiness.
3. [`03_BACKEND_AUDIT.md`](<file:///f:/New%20folder%20(3)/docs/architecture/03_BACKEND_AUDIT.md>): Verification of current backend absence, audit of existing edge functions and PL/pgSQL RPCs, and complete target Python FastAPI architecture.
4. [`04_SUPABASE_DATABASE_AUDIT.md`](<file:///f:/New%20folder%20(3)/docs/architecture/04_SUPABASE_DATABASE_AUDIT.md>): Verified schema inventory of all 16 tables, 2 views, 19 functions, 10 triggers, 4 storage buckets, and migrations.
5. [`05_RLS_SECURITY_AUDIT.md`](<file:///f:/New%20folder%20(3)/docs/architecture/05_RLS_SECURITY_AUDIT.md>): Deep-dive audit of all 39 RLS policies, multi-tenant isolation gaps, and target security policies.
6. [`06_ATTENDANCE_GEOFENCING_ARCHITECTURE.md`](<file:///f:/New%20folder%20(3)/docs/architecture/06_ATTENDANCE_GEOFENCING_ARCHITECTURE.md>): Geofence boundary specification, GPS eligibility gating, manual action lifecycle, and shift rules.
7. [`07_CAPACITOR_MOBILE_ARCHITECTURE.md`](<file:///f:/New%20folder%20(3)/docs/architecture/07_CAPACITOR_MOBILE_ARCHITECTURE.md>): Native Android (Geofencing API) and iOS (Core Location) mobile wrapper architecture, permissions, and lifecycle.
8. [`08_GOOGLE_DRIVE_ARCHIVE_ARCHITECTURE.md`](<file:///f:/New%20folder%20(3)/docs/architecture/08_GOOGLE_DRIVE_ARCHIVE_ARCHITECTURE.md>): Multi-tenant Google Drive OAuth 2.0 integration, monthly aggregation engine, and PDF upload verification.
9. [`09_DATABASE_TARGET_SCHEMA.md`](<file:///f:/New%20folder%20(3)/docs/architecture/09_DATABASE_TARGET_SCHEMA.md>): Complete DDL specifications for proposed entities covering Core, Geofencing, Attendance, HRMS, and Archival.
10. [`10_PHASE_2_IMPLEMENTATION_PLAN.md`](<file:///f:/New%20folder%20(3)/docs/architecture/10_PHASE_2_IMPLEMENTATION_PLAN.md>): Detailed phased migration plan, dependency roadmap, risk mitigation matrix, and deployment checklist.
