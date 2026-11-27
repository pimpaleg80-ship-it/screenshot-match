import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  calculateHaversineDistance,
  evaluateGeofenceState,
  getHysteresisBufferMeters,
  validateCoordinates,
  validateRadiusMeters,
  type GeofenceLocation,
} from "../lib/geofence";
import {
  validateAttendanceInput,
  verifyGeofencePolicy,
} from "../../supabase/functions/verify-attendance/verification";
import type { UseGeofenceSyncResult } from "../hooks/use-geofence-sync";

// Mock useGeofenceSync & supabase for deterministic UI component assertions
const mockUseGeofenceSync = vi.fn<() => UseGeofenceSyncResult>();
const mockInvoke = vi.fn();

vi.mock("../hooks/use-geofence-sync", () => ({
  useGeofenceSync: () => mockUseGeofenceSync(),
}));

vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn().mockResolvedValue("ok"),
  },
}));

vi.mock("../hooks/use-session", () => ({
  useSession: () => ({
    organizationId: "org-1",
    employeeId: "emp-1",
    role: "admin",
  }),
}));

import { GeofenceAttendanceCard } from "../components/geofence-attendance-card";
import { AdminLocationStudio } from "../components/admin/location-studio";

const MAIN_OFFICE: GeofenceLocation & { organization_id: string; is_active: boolean } = {
  id: "loc-main-office",
  organization_id: "org-1",
  name: "Main Office",
  address: "Block A",
  latitude: 19.0948,
  longitude: 74.748,
  radius_meters: 150,
  is_active: true,
};

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function buildSyncState(overrides: Partial<UseGeofenceSyncResult> = {}): UseGeofenceSyncResult {
  const now = Date.now();
  return {
    context: {
      employee: { id: "emp-1", name: "Ada Lovelace", organization_id: "org-1" },
      location: MAIN_OFFICE,
      today_attendance: null,
      shift: null,
    },
    contextLoading: false,
    contextError: null,
    refetchContext: vi.fn().mockResolvedValue(undefined),
    coords: {
      latitude: 19.0948,
      longitude: 74.748,
      accuracy: 15,
      timestamp: now,
      isMock: false,
      source: "native_gps",
    },
    locating: false,
    locationError: null,
    permissionDenied: false,
    gpsDisabled: false,
    permissionState: "granted",
    isOffline: false,
    realtimeStatus: "connected",
    evaluation: evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: {
        latitude: 19.0948,
        longitude: 74.748,
        accuracy: 15,
        timestamp: now,
        isMock: false,
        source: "native_gps",
      },
      nowMs: now,
    }),
    refreshLocation: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("Main Office Coordinate Validation & Radius Bounds", () => {
  it("validates valid coordinates (Main Office example) and rejects out-of-range inputs", () => {
    expect(validateCoordinates(19.0948, 74.748)).toEqual({ valid: true });
    expect(validateCoordinates(-90, -180).valid).toBe(true);
    expect(validateCoordinates(90.0001, 74.748).valid).toBe(false);
    expect(validateCoordinates(-90.1, 74.748).valid).toBe(false);
    expect(validateCoordinates(19.0948, 180.1).valid).toBe(false);
    expect(validateCoordinates(19.0948, -180.1).valid).toBe(false);

    expect(validateRadiusMeters(150)).toEqual({ valid: true });
    expect(validateRadiusMeters(0).valid).toBe(false);
    expect(validateRadiusMeters(-25).valid).toBe(false);
    expect(validateRadiusMeters(60000).valid).toBe(false);
  });

  it("renders AdminLocationStudio with zero hardcoded coordinates when creating an office", () => {
    renderWithQuery(<AdminLocationStudio />);
    const latInput = screen.getByPlaceholderText("Enter latitude") as HTMLInputElement;
    const lngInput = screen.getByPlaceholderText("Enter longitude") as HTMLInputElement;

    expect(latInput.value).toBe("");
    expect(lngInput.value).toBe("");
    expect(screen.getByRole("button", { name: /Save Location/i })).toBeDisabled();

    // Entering invalid coordinates keeps Save disabled and surfaces validation error
    fireEvent.change(screen.getByPlaceholderText("Enter office name"), {
      target: { value: "Main Office" },
    });
    fireEvent.change(latInput, { target: { value: "95" } });
    fireEvent.change(lngInput, { target: { value: "74.7480" } });
    expect(screen.getByRole("button", { name: /Save Location/i })).toBeDisabled();

    // Entering valid Main Office coordinates enables Save Location
    fireEvent.change(latInput, { target: { value: "19.0948" } });
    expect(screen.getByRole("button", { name: /Save Location/i })).toBeEnabled();
  }, 15000);
});

describe("Geofence Evaluation, Hysteresis, Stale/Accuracy/Mock/Permission Guards", () => {
  const now = 1_760_000_000_000;

  it("evaluates inside and outside perimeter with hysteresis buffer preventing edge flicker", () => {
    // 150m radius -> hysteresis = 15m -> exit threshold = 165m
    expect(getHysteresisBufferMeters(150)).toBe(15);

    // ~158m north of center (+0.00142 deg lat)
    const edgeLat = MAIN_OFFICE.latitude + 0.00142;
    const dist = calculateHaversineDistance(
      edgeLat,
      MAIN_OFFICE.longitude,
      MAIN_OFFICE.latitude,
      MAIN_OFFICE.longitude,
    );
    expect(dist).toBeGreaterThan(150);
    expect(dist).toBeLessThan(165);

    const freshEdgeCoords = {
      latitude: edgeLat,
      longitude: MAIN_OFFICE.longitude,
      accuracy: 10,
      timestamp: now,
      source: "native_gps" as const,
    };

    // Entering from outside at 158m stays outside
    const entering = evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: freshEdgeCoords,
      previouslyInside: false,
      nowMs: now,
    });
    expect(entering.status).toBe("outside");
    expect(entering.canCheckIn).toBe(false);

    // Already inside at 158m stays inside due to hysteresis
    const lingeringInside = evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: freshEdgeCoords,
      previouslyInside: true,
      nowMs: now,
    });
    expect(lingeringInside.status).toBe("inside");
    expect(lingeringInside.canCheckIn).toBe(true);
  });

  it("blocks attendance on denied permission, disabled GPS, poor accuracy, stale readings, mock locations, and inactive geofence", () => {
    const baseCoords = {
      latitude: MAIN_OFFICE.latitude,
      longitude: MAIN_OFFICE.longitude,
      accuracy: 12,
      timestamp: now,
      source: "native_gps" as const,
    };

    const denied = evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: baseCoords,
      permissionDenied: true,
      nowMs: now,
    });
    expect(denied.status).toBe("permission_denied");
    expect(denied.headline).toBe("Unable to detect your location.");
    expect(denied.canCheckIn).toBe(false);

    const disabled = evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: null,
      gpsDisabled: true,
      nowMs: now,
    });
    expect(disabled.status).toBe("gps_disabled");
    expect(disabled.headline).toBe("Unable to detect your location.");
    expect(disabled.canCheckIn).toBe(false);

    const poor = evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: { ...baseCoords, accuracy: 220 },
      nowMs: now,
    });
    expect(poor.status).toBe("poor_accuracy");
    expect(poor.canCheckIn).toBe(false);

    const stale = evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: { ...baseCoords, timestamp: now - 180_000 },
      nowMs: now,
    });
    expect(stale.status).toBe("stale_reading");
    expect(stale.canCheckIn).toBe(false);

    const mocked = evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: { ...baseCoords, isMock: true },
      nowMs: now,
    });
    expect(mocked.status).toBe("mock_detected");
    expect(mocked.canCheckIn).toBe(false);

    const inactive = evaluateGeofenceState({
      location: { ...MAIN_OFFICE, is_active: false },
      coords: baseCoords,
      nowMs: now,
    });
    expect(inactive.status).toBe("inactive");
    expect(inactive.canCheckIn).toBe(false);
    expect(inactive.canCheckOutWhenCheckedIn).toBe(false);
  });
});

describe("Edge Function verify-attendance Server Verification Logic", () => {
  const now = 1_760_000_000_000;

  it("rejects spoofed IP sources, poor accuracy, stale timestamps, and mock GPS server-side", () => {
    expect(
      validateAttendanceInput(
        {
          action: "check_in",
          latitude: 19.0948,
          longitude: 74.748,
          accuracy: 10,
          timestamp: now,
          location_source: "ip_geolocation",
        },
        now,
      ).ok,
    ).toBe(false);

    const mockRes = validateAttendanceInput(
      {
        action: "check_in",
        latitude: 19.0948,
        longitude: 74.748,
        accuracy: 10,
        timestamp: now,
        is_mock: true,
      },
      now,
    );
    expect(mockRes.ok).toBe(false);
    if (!mockRes.ok) expect(mockRes.status).toBe(403);

    const staleRes = validateAttendanceInput(
      {
        action: "check_in",
        latitude: 19.0948,
        longitude: 74.748,
        accuracy: 10,
        timestamp: now - 300_000,
      },
      now,
    );
    expect(staleRes.ok).toBe(false);
    if (!staleRes.ok) expect(staleRes.code).toBe("STALE_LOCATION");
  });

  it("enforces inside-radius Check In, prevents duplicates, and allows manual Check Out upon leaving geofence", () => {
    const insideInput = validateAttendanceInput(
      {
        action: "check_in",
        latitude: 19.0949,
        longitude: 74.7481,
        accuracy: 12,
        timestamp: now,
        location_source: "native_gps",
      },
      now,
    );
    expect(insideInput.ok).toBe(true);
    if (!insideInput.ok) return;

    // 1. Check In inside radius succeeds
    const checkInAllowed = verifyGeofencePolicy({
      input: insideInput.data,
      location: MAIN_OFFICE,
      todayAttendance: null,
    });
    expect(checkInAllowed.allowed).toBe(true);

    // 2. Duplicate Check In fails (409)
    const dupCheckIn = verifyGeofencePolicy({
      input: insideInput.data,
      location: MAIN_OFFICE,
      todayAttendance: { id: "att-1", check_in: "2026-11-25T09:00:00Z", check_out: null },
    });
    expect(dupCheckIn.allowed).toBe(false);
    if (!dupCheckIn.allowed) expect(dupCheckIn.status).toBe(409);

    // 3. Check In outside radius (~500m away) fails (403)
    const outsideCheckInInput = validateAttendanceInput(
      {
        action: "check_in",
        latitude: 19.0995,
        longitude: 74.748,
        accuracy: 12,
        timestamp: now,
      },
      now,
    );
    expect(outsideCheckInInput.ok).toBe(true);
    if (!outsideCheckInInput.ok) return;

    const deniedOutside = verifyGeofencePolicy({
      input: outsideCheckInInput.data,
      location: MAIN_OFFICE,
      todayAttendance: null,
    });
    expect(deniedOutside.allowed).toBe(false);
    if (!deniedOutside.allowed) expect(deniedOutside.status).toBe(403);

    // 4. Manual Check Out after exiting office geofence succeeds
    const outsideCheckOutInput = validateAttendanceInput(
      {
        action: "check_out",
        latitude: 19.0995,
        longitude: 74.748,
        accuracy: 12,
        timestamp: now,
      },
      now,
    );
    expect(outsideCheckOutInput.ok).toBe(true);
    if (!outsideCheckOutInput.ok) return;

    const checkOutAllowed = verifyGeofencePolicy({
      input: outsideCheckOutInput.data,
      location: MAIN_OFFICE,
      todayAttendance: { id: "att-1", check_in: "2026-11-25T09:00:00Z", check_out: null },
    });
    expect(checkOutAllowed.allowed).toBe(true);
    if (checkOutAllowed.allowed) expect(checkOutAllowed.eventType).toBe("EXIT");
  });
});

describe("Employee GeofenceAttendanceCard Manual Check-In & Exit Check-Out UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables Check In only when inside office geofence and never auto-punches", () => {
    mockUseGeofenceSync.mockReturnValue(buildSyncState());
    renderWithQuery(<GeofenceAttendanceCard employeeId="emp-1" />);

    expect(screen.getByText("You are inside the office area.")).toBeInTheDocument();
    const checkInBtn = screen.getByRole("button", { name: /^Check In$/i });
    expect(checkInBtn).toBeEnabled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("disables Check In when outside office geofence", () => {
    const outsideEval = evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: {
        latitude: 19.0995,
        longitude: 74.748,
        accuracy: 10,
        timestamp: Date.now(),
        source: "native_gps",
      },
    });
    mockUseGeofenceSync.mockReturnValue(buildSyncState({ evaluation: outsideEval }));
    renderWithQuery(<GeofenceAttendanceCard employeeId="emp-1" />);

    expect(screen.getByText("You are outside the office area.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Check In$/i })).toBeDisabled();
  });

  it("unlocks manual Check Out when checked-in employee exits office area", () => {
    const outsideEval = evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: {
        latitude: 19.0995,
        longitude: 74.748,
        accuracy: 10,
        timestamp: Date.now(),
        source: "native_gps",
      },
    });
    mockUseGeofenceSync.mockReturnValue(
      buildSyncState({
        context: {
          employee: { id: "emp-1", name: "Ada Lovelace", organization_id: "org-1" },
          location: MAIN_OFFICE,
          today_attendance: {
            id: "att-1",
            check_in: "2026-11-25T03:30:00.000Z",
            check_out: null,
            status: "present",
            total_hours: null,
          },
          shift: null,
        },
        evaluation: outsideEval,
      }),
    );

    renderWithQuery(<GeofenceAttendanceCard employeeId="emp-1" />);

    expect(screen.getByText("You are outside the office area.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Check Out$/i })).toBeEnabled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("displays Retry Location banner and disables attendance when GPS fails", () => {
    const deniedEval = evaluateGeofenceState({
      location: MAIN_OFFICE,
      coords: null,
      permissionDenied: true,
    });
    mockUseGeofenceSync.mockReturnValue(
      buildSyncState({
        coords: null,
        permissionDenied: true,
        evaluation: deniedEval,
      }),
    );

    renderWithQuery(<GeofenceAttendanceCard employeeId="emp-1" />);

    expect(screen.getByText("Unable to detect your location.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Retry Location/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /^Check In$/i })).toBeDisabled();
  });
});
