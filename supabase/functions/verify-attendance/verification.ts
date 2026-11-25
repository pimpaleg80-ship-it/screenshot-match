export interface GeofenceCenter {
  id: string;
  organization_id?: string | null | undefined;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  is_active: boolean;
}

export interface VerifyAttendancePayload {
  action?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  timestamp?: unknown;
  recorded_at?: unknown;
  is_mock?: unknown;
  device_id?: unknown;
  location_source?: unknown;
  work_location_id?: unknown;
}

export interface ValidatedAttendanceInput {
  action: "check_in" | "check_out";
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAtIso: string;
  isMock: boolean;
  deviceId: string | null;
  locationSource: string;
}

export const MAX_GPS_ACCURACY_METERS = 150;
export const MAX_READING_AGE_MS = 120_000; // 2 minutes
export const MAX_FUTURE_SKEW_MS = 60_000; // 1 minute

const UNTRUSTED_COARSE_SOURCES = new Set([
  "ip",
  "ip_geolocation",
  "edge_ip",
  "network_ip",
  "coarse_ip",
]);

export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Math.round(R * c * 10) / 10;
}

function isFiniteInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === "number" && Number.isFinite(val) && val >= min && val <= max;
}

export function isValidCoordinatePair(lat: unknown, lon: unknown): boolean {
  return isFiniteInRange(lat, -90, 90) && isFiniteInRange(lon, -180, 180);
}

export function parseReadingTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function validateAttendanceInput(
  body: VerifyAttendancePayload,
  nowMs: number = Date.now(),
): { ok: true; data: ValidatedAttendanceInput } | { ok: false; status: number; code: string; error: string } {
  const action = body.action;
  if (action !== "check_in" && action !== "check_out") {
    return {
      ok: false,
      status: 400,
      code: "INVALID_ACTION",
      error: "Action must be 'check_in' or 'check_out'.",
    };
  }

  if (body.is_mock === true) {
    return {
      ok: false,
      status: 403,
      code: "MOCK_LOCATION_DETECTED",
      error: "Simulated or mock GPS locations cannot be used to record attendance.",
    };
  }

  const rawLat = body.latitude;
  const rawLon = body.longitude;
  if (!isFiniteInRange(rawLat, -90, 90) || !isFiniteInRange(rawLon, -180, 180)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_COORDINATES",
      error: "Valid finite latitude (-90..90) and longitude (-180..180) are required.",
    };
  }

  const locationSource =
    typeof body.location_source === "string" && body.location_source.trim().length > 0
      ? body.location_source.trim().toLowerCase()
      : "gps";

  if (UNTRUSTED_COARSE_SOURCES.has(locationSource)) {
    return {
      ok: false,
      status: 422,
      code: "COARSE_IP_UNSUPPORTED",
      error: "Approximate IP location cannot verify office presence. Please enable device GPS.",
    };
  }

  const accuracy = typeof body.accuracy === "number" ? body.accuracy : Number.NaN;
  if (!Number.isFinite(accuracy) || accuracy <= 0) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_ACCURACY",
      error: "A positive GPS accuracy reading in meters is required.",
    };
  }

  if (accuracy > MAX_GPS_ACCURACY_METERS) {
    return {
      ok: false,
      status: 422,
      code: "POOR_GPS_ACCURACY",
      error: `GPS accuracy (±${Math.round(accuracy)}m) exceeds the ${MAX_GPS_ACCURACY_METERS}m limit. Move to a clearer signal area and retry.`,
    };
  }

  const rawTs = body.recorded_at ?? body.timestamp;
  const readingMs = parseReadingTimestampMs(rawTs);
  if (readingMs === null) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_TIMESTAMP",
      error: "A valid GPS reading timestamp is required.",
    };
  }

  if (nowMs - readingMs > MAX_READING_AGE_MS) {
    return {
      ok: false,
      status: 422,
      code: "STALE_LOCATION",
      error: "Location reading is stale. Please refresh your GPS position before punching attendance.",
    };
  }

  if (readingMs - nowMs > MAX_FUTURE_SKEW_MS) {
    return {
      ok: false,
      status: 400,
      code: "FUTURE_TIMESTAMP",
      error: "GPS timestamp is too far in the future. Please check your device clock.",
    };
  }

  const deviceId =
    typeof body.device_id === "string" && body.device_id.trim().length > 0
      ? body.device_id.trim().slice(0, 128)
      : null;

  return {
    ok: true,
    data: {
      action,
      latitude: rawLat,
      longitude: rawLon,
      accuracy: Math.round(accuracy * 10) / 10,
      recordedAtIso: new Date(readingMs).toISOString(),
      isMock: false,
      deviceId,
      locationSource,
    },
  };
}

export function verifyGeofencePolicy(params: {
  input: ValidatedAttendanceInput;
  location: GeofenceCenter | null;
  todayAttendance: { id: string; check_in: string | null; check_out: string | null } | null;
}):
  | {
      allowed: true;
      distanceMeters: number;
      allowedRadius: number;
      eventType: "ENTER" | "EXIT";
    }
  | {
      allowed: false;
      status: number;
      code: string;
      error: string;
      distanceMeters?: number;
      allowedRadius?: number;
    } {
  const { input, location, todayAttendance } = params;

  if (!location || !location.is_active || !isValidCoordinatePair(location.latitude, location.longitude)) {
    return {
      allowed: false,
      status: 422,
      code: "NO_ACTIVE_GEOFENCE",
      error: "No active Main Office geofence is configured for your organization.",
    };
  }

  const allowedRadius = Number(location.radius_meters);
  if (!Number.isFinite(allowedRadius) || allowedRadius <= 0) {
    return {
      allowed: false,
      status: 422,
      code: "INVALID_GEOFENCE_RADIUS",
      error: "Configured office geofence radius is invalid.",
    };
  }

  const distanceMeters = calculateHaversineDistanceMeters(
    input.latitude,
    input.longitude,
    location.latitude as number,
    location.longitude as number,
  );
  const isInside = distanceMeters <= allowedRadius;

  if (input.action === "check_in") {
    if (!isInside) {
      return {
        allowed: false,
        status: 403,
        code: "OUTSIDE_GEOFENCE",
        error: `You are ${distanceMeters}m away from ${location.name} (Allowed radius: ${allowedRadius}m). Check-in is only permitted inside the office geofence.`,
        distanceMeters,
        allowedRadius,
      };
    }

    if (todayAttendance?.check_in) {
      return {
        allowed: false,
        status: 409,
        code: "ALREADY_CHECKED_IN",
        error: "You have already checked in for today.",
        distanceMeters,
        allowedRadius,
      };
    }

    return {
      allowed: true,
      distanceMeters,
      allowedRadius,
      eventType: "ENTER",
    };
  }

  // check_out action
  if (!todayAttendance || !todayAttendance.check_in) {
    return {
      allowed: false,
      status: 409,
      code: "NOT_CHECKED_IN",
      error: "Cannot check out before checking in for today.",
      distanceMeters,
      allowedRadius,
    };
  }

  if (todayAttendance.check_out) {
    return {
      allowed: false,
      status: 409,
      code: "ALREADY_CHECKED_OUT",
      error: "You have already checked out for today.",
      distanceMeters,
      allowedRadius,
    };
  }

  return {
    allowed: true,
    distanceMeters,
    allowedRadius,
    eventType: "EXIT",
  };
}
