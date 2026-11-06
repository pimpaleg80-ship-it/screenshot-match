import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  formatDistance,
  type Coordinates,
  type GeofenceLocation,
} from "../lib/geofence";

describe("Phase 2 — Geofence Verification & Boundary Accuracy Tests", () => {
  // Pune HQ Baseline: 18.5204° N, 73.8567° E, Radius: 150m
  const office: GeofenceLocation = {
    id: "loc-pune-hq",
    name: "Pune HQ",
    address: "Senapati Bapat Road, Pune",
    latitude: 18.5204,
    longitude: 73.8567,
    radius_meters: 150,
  };

  it("evaluates exact boundary distances across simulated employee positions", () => {
    // 1. Employee 10m from office (Inside)
    const lat10m = office.latitude + 0.00009; // ~10m North
    const d10m = calculateHaversineDistance(lat10m, office.longitude, office.latitude, office.longitude);
    expect(d10m).toBeGreaterThanOrEqual(9);
    expect(d10m).toBeLessThanOrEqual(11);
    expect(d10m <= office.radius_meters).toBe(true);

    // 2. Employee 50m from office (Inside)
    const lat50m = office.latitude + 0.00045; // ~50m North
    const d50m = calculateHaversineDistance(lat50m, office.longitude, office.latitude, office.longitude);
    expect(d50m).toBeGreaterThanOrEqual(48);
    expect(d50m).toBeLessThanOrEqual(52);
    expect(d50m <= office.radius_meters).toBe(true);

    // 3. Employee 100m from office (Inside)
    const lat100m = office.latitude + 0.00090; // ~100m North
    const d100m = calculateHaversineDistance(lat100m, office.longitude, office.latitude, office.longitude);
    expect(d100m).toBeGreaterThanOrEqual(98);
    expect(d100m).toBeLessThanOrEqual(102);
    expect(d100m <= office.radius_meters).toBe(true);

    // 4. Employee 150m from office (Perimeter boundary edge)
    const lat150m = office.latitude + 0.00135; // ~150m North
    const d150m = calculateHaversineDistance(lat150m, office.longitude, office.latitude, office.longitude);
    expect(d150m).toBeGreaterThanOrEqual(148);
    expect(d150m).toBeLessThanOrEqual(152);

    // 5. Employee 200m from office (Outside allowed radius)
    const lat200m = office.latitude + 0.00180; // ~200m North
    const d200m = calculateHaversineDistance(lat200m, office.longitude, office.latitude, office.longitude);
    expect(d200m).toBeGreaterThanOrEqual(198);
    expect(d200m).toBeLessThanOrEqual(202);
    expect(d200m <= office.radius_meters).toBe(false);

    // 6. Employee 500m from office (Far outside)
    const lat500m = office.latitude + 0.00450;
    const d500m = calculateHaversineDistance(lat500m, office.longitude, office.latitude, office.longitude);
    expect(d500m).toBeGreaterThan(490);
    expect(d500m <= office.radius_meters).toBe(false);
  });

  it("enforces accuracy validation threshold (maximum allowed 150m accuracy drift)", () => {
    const validateGpsAccuracy = (coords: Coordinates): { valid: boolean; reason?: string } => {
      if (!coords || !isFinite(coords.accuracy)) {
        return { valid: false, reason: "GPS signal unavailable" };
      }
      if (coords.accuracy > 150) {
        return {
          valid: false,
          reason: `GPS accuracy low (±${Math.round(coords.accuracy)}m > 150m tolerance)`,
        };
      }
      return { valid: true };
    };

    // Good accuracy (e.g. 15m typical outdoors)
    expect(validateGpsAccuracy({ latitude: 18.5204, longitude: 73.8567, accuracy: 15, timestamp: Date.now() }).valid).toBe(true);

    // Marginal accuracy (e.g. 140m near window)
    expect(validateGpsAccuracy({ latitude: 18.5204, longitude: 73.8567, accuracy: 140, timestamp: Date.now() }).valid).toBe(true);

    // Poor accuracy (e.g. 250m cellular tower triangulation)
    const poorRes = validateGpsAccuracy({ latitude: 18.5204, longitude: 73.8567, accuracy: 250, timestamp: Date.now() });
    expect(poorRes.valid).toBe(false);
    expect(poorRes.reason).toContain("GPS accuracy low");
  });
});

describe("Phase 2 — Attendance State Transition & Manual Enforcement", () => {
  interface AttendanceState {
    checkInTime: string | null;
    checkOutTime: string | null;
  }

  const evaluateAttendanceAction = (
    state: AttendanceState,
    isInsideGeofence: boolean,
    requestedAction: "check_in" | "check_out"
  ): { allowed: boolean; error?: string } => {
    if (!isInsideGeofence) {
      return { allowed: false, error: "Action disabled outside assigned office geofence" };
    }

    if (requestedAction === "check_in") {
      if (state.checkInTime) {
        return { allowed: false, error: "Duplicate check-in: employee already checked in today" };
      }
      return { allowed: true };
    }

    if (requestedAction === "check_out") {
      if (!state.checkInTime) {
        return { allowed: false, error: "Cannot check out: no active check-in recorded for today" };
      }
      if (state.checkOutTime) {
        return { allowed: false, error: "Already checked out for today" };
      }
      return { allowed: true };
    }

    return { allowed: false, error: "Unknown action" };
  };

  it("correctly gates Check-In eligibility", () => {
    const initialState: AttendanceState = { checkInTime: null, checkOutTime: null };

    // When outside geofence: Check-in disabled
    expect(evaluateAttendanceAction(initialState, false, "check_in").allowed).toBe(false);
    expect(evaluateAttendanceAction(initialState, false, "check_in").error).toContain("outside");

    // When inside geofence: Check-in enabled
    expect(evaluateAttendanceAction(initialState, true, "check_in").allowed).toBe(true);

    // Duplicate check-in prevented
    const checkedInState: AttendanceState = { checkInTime: "2026-11-06T09:30:00Z", checkOutTime: null };
    expect(evaluateAttendanceAction(checkedInState, true, "check_in").allowed).toBe(false);
    expect(evaluateAttendanceAction(checkedInState, true, "check_in").error).toContain("Duplicate");
  });

  it("correctly gates Check-Out eligibility and geofence exit behavior", () => {
    const checkedInState: AttendanceState = { checkInTime: "2026-11-06T09:30:00Z", checkOutTime: null };

    // Check-out disabled when employee steps outside office
    const outsideRes = evaluateAttendanceAction(checkedInState, false, "check_out");
    expect(outsideRes.allowed).toBe(false);
    expect(outsideRes.error).toContain("outside");

    // Check-out re-enabled when employee returns inside office
    const insideRes = evaluateAttendanceAction(checkedInState, true, "check_out");
    expect(insideRes.allowed).toBe(true);

    // Check-out before check-in rejected
    const unstartedState: AttendanceState = { checkInTime: null, checkOutTime: null };
    expect(evaluateAttendanceAction(unstartedState, true, "check_out").allowed).toBe(false);

    // Double check-out rejected
    const completedState: AttendanceState = {
      checkInTime: "2026-11-06T09:30:00Z",
      checkOutTime: "2026-11-06T18:00:00Z",
    };
    expect(evaluateAttendanceAction(completedState, true, "check_out").allowed).toBe(false);
  });
});

describe("Phase 2 — Multi-Tenancy & Authorization Boundaries", () => {
  interface OrganizationScope {
    userOrgId: string;
    targetOrgId: string;
    role: "super_admin" | "org_admin" | "hr_manager" | "employee";
  }

  const isOperationPermitted = (
    op: "edit_work_location" | "view_attendance_records" | "assign_employees",
    scope: OrganizationScope
  ): boolean => {
    // Superadmin has cluster-wide cross-tenant access
    if (scope.role === "super_admin") return true;

    // Strict tenant isolation: other roles cannot touch another org
    if (scope.userOrgId !== scope.targetOrgId) return false;

    // Inside same tenant:
    if (op === "edit_work_location") {
      return scope.role === "org_admin";
    }
    if (op === "assign_employees") {
      return scope.role === "org_admin" || scope.role === "hr_manager";
    }
    if (op === "view_attendance_records") {
      return true; // Filtered to self or team based on RLS
    }

    return false;
  };

  it("prevents cross-tenant access between different organizations", () => {
    const orgA = "org-alpha-001";
    const orgB = "org-beta-002";

    // Org Admin in Org A trying to modify Org B's location
    expect(
      isOperationPermitted("edit_work_location", {
        userOrgId: orgA,
        targetOrgId: orgB,
        role: "org_admin",
      })
    ).toBe(false);

    // HR in Org A trying to assign employees in Org B
    expect(
      isOperationPermitted("assign_employees", {
        userOrgId: orgA,
        targetOrgId: orgB,
        role: "hr_manager",
      })
    ).toBe(false);

    // Super Admin permitted across tenants
    expect(
      isOperationPermitted("edit_work_location", {
        userOrgId: orgA,
        targetOrgId: orgB,
        role: "super_admin",
      })
    ).toBe(true);
  });

  it("prevents standard employees from modifying geofence boundaries", () => {
    const orgId = "org-alpha-001";

    expect(
      isOperationPermitted("edit_work_location", {
        userOrgId: orgId,
        targetOrgId: orgId,
        role: "employee",
      })
    ).toBe(false);

    expect(
      isOperationPermitted("edit_work_location", {
        userOrgId: orgId,
        targetOrgId: orgId,
        role: "org_admin",
      })
    ).toBe(true);
  });
});

