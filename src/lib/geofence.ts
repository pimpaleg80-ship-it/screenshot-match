import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_MAX_GPS_ACCURACY_METERS = 150;
export const DEFAULT_MAX_GPS_AGE_MS = 120_000; // 2 minutes
export const DEFAULT_HYSTERESIS_CAP_METERS = 25;

export type LocationSource =
  | "native_gps"
  | "browser_gps"
  | "browser_network";

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isMock?: boolean | undefined;
  source?: LocationSource | undefined;
  city?: string | undefined;
}

export interface GeofenceLocation {
  id: string;
  organization_id?: string | null | undefined;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active?: boolean | undefined;
  updated_at?: string | undefined;
}

export interface GeofenceContext {
  employee: {
    id: string;
    name: string;
    organization_id: string;
  };
  location: GeofenceLocation | null;
  today_attendance: {
    id: string;
    check_in: string | null;
    check_out: string | null;
    status: string;
    total_hours: number | null;
  } | null;
  shift: {
    name: string;
    start_time: string;
    end_time: string;
  } | null;
}

export type GeofenceEvaluationStatus =
  | "inside"
  | "outside"
  | "inactive"
  | "unconfigured"
  | "permission_denied"
  | "gps_disabled"
  | "poor_accuracy"
  | "stale_reading"
  | "mock_detected"
  | "unavailable";

export interface GeofenceEvaluationResult {
  status: GeofenceEvaluationStatus;
  isInside: boolean;
  isOutside: boolean;
  canCheckIn: boolean;
  canCheckOutWhenCheckedIn: boolean;
  distanceMeters: number | null;
  hysteresisMeters: number;
  effectiveExitThresholdMeters: number | null;
  headline: string;
  reason: string;
}

export type GeolocationFailureCode =
  | "PERMISSION_DENIED"
  | "GPS_DISABLED"
  | "TIMEOUT"
  | "UNSUPPORTED"
  | "UNAVAILABLE";

export class GeolocationAcquisitionError extends Error {
  readonly code: GeolocationFailureCode;

  constructor(code: GeolocationFailureCode, message: string) {
    super(message);
    this.name = "GeolocationAcquisitionError";
    this.code = code;
  }
}

/**
 * Reusable Haversine distance formula (in meters) between two WGS-84 coordinate points.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return Infinity;
  }
  const R = 6371000.0; // Earth mean radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180.0;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0);
  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1.0 - a)));

  return R * c;
}

/**
 * Compute adaptive hysteresis exit buffer to prevent flickering near the boundary.
 * Entry still enforces exact configured `radiusMeters`.
 */
export function getHysteresisBufferMeters(
  radiusMeters: number,
  overrideMeters?: number,
): number {
  if (overrideMeters !== undefined) {
    return Math.max(0, overrideMeters);
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    return 0;
  }
  return Math.min(DEFAULT_HYSTERESIS_CAP_METERS, Math.max(5, Math.round(radiusMeters * 0.1)));
}

/**
 * Format meters into human-friendly string (e.g. "15m", "1.2km").
 */
export function formatDistance(meters: number): string {
  if (!isFinite(meters)) return "Unknown distance";
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Categorize GPS accuracy based on strict attendance security rules:
 * - <= 50m: Good (High precision, satellites or high-accuracy mobile GPS)
 * - 51m - 100m: Warning (Acceptable but advisory warning displayed)
 * - > 150m: Rejected (Signal too unreliable for attendance verification)
 */
export function getAccuracyCategory(
  accuracyMeters: number,
  maxAllowed = DEFAULT_MAX_GPS_ACCURACY_METERS,
): {
  level: "good" | "warning" | "rejected";
  label: string;
  description: string;
} {
  if (!isFinite(accuracyMeters) || accuracyMeters <= 0) {
    return {
      level: "rejected",
      label: "Invalid Signal",
      description: "Unable to evaluate GPS accuracy.",
    };
  }

  if (accuracyMeters <= 50) {
    return {
      level: "good",
      label: "High Precision",
      description: `GPS accuracy is high (±${Math.round(accuracyMeters)}m).`,
    };
  }

  if (accuracyMeters <= 100) {
    return {
      level: "warning",
      label: "Moderate Accuracy",
      description: `GPS accuracy is moderate (±${Math.round(accuracyMeters)}m).`,
    };
  }

  if (accuracyMeters <= maxAllowed) {
    return {
      level: "warning",
      label: "Marginal Signal",
      description: `GPS accuracy is marginal (±${Math.round(accuracyMeters)}m ≤ ${maxAllowed}m max). Step outdoors if unstable.`,
    };
  }

  return {
    level: "rejected",
    label: "Accuracy Too Low",
    description: `GPS accuracy (±${Math.round(accuracyMeters)}m) exceeds the ${maxAllowed}m precision limit.`,
  };
}

/**
 * Validate geographic coordinate bounds and radius positivity.
 */
export function validateCoordinates(
  lat: number,
  lng: number,
): { valid: boolean; reason?: string } {
  if (!isFinite(lat) || isNaN(lat)) {
    return { valid: false, reason: "Latitude must be a valid number." };
  }
  if (!isFinite(lng) || isNaN(lng)) {
    return { valid: false, reason: "Longitude must be a valid number." };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, reason: "Latitude must be between -90.0° and +90.0°." };
  }
  if (lng < -180 || lng > 180) {
    return { valid: false, reason: "Longitude must be between -180.0° and +180.0°." };
  }
  return { valid: true };
}

export function validateRadiusMeters(
  radius: number,
): { valid: boolean; reason?: string } {
  if (!Number.isFinite(radius) || Number.isNaN(radius) || radius <= 0) {
    return { valid: false, reason: "Geofence radius must be greater than 0 meters." };
  }
  if (radius > 50000) {
    return { valid: false, reason: "Geofence radius cannot exceed 50,000 meters." };
  }
  return { valid: true };
}

/**
 * Evaluate employee geofence state strictly from verified active config + live GPS reading.
 * Guarantees stale, inaccurate, denied, disabled, or mocked readings never enable attendance.
 */
export function evaluateGeofenceState(params: {
  location: GeofenceLocation | null;
  coords: Coordinates | null;
  permissionDenied?: boolean;
  gpsDisabled?: boolean;
  previouslyInside?: boolean;
  maxAccuracyMeters?: number;
  maxAgeMs?: number;
  hysteresisMeters?: number;
  nowMs?: number;
}): GeofenceEvaluationResult {
  const {
    location,
    coords,
    permissionDenied = false,
    gpsDisabled = false,
    previouslyInside = false,
    maxAccuracyMeters = DEFAULT_MAX_GPS_ACCURACY_METERS,
    maxAgeMs = DEFAULT_MAX_GPS_AGE_MS,
    hysteresisMeters: hysteresisOverride,
    nowMs = Date.now(),
  } = params;

  if (!location) {
    return {
      status: "unconfigured",
      isInside: false,
      isOutside: false,
      canCheckIn: false,
      canCheckOutWhenCheckedIn: false,
      distanceMeters: null,
      hysteresisMeters: 0,
      effectiveExitThresholdMeters: null,
      headline: "No active office geofence configured.",
      reason: "Ask your HR Administrator to configure the Main Office coordinates in Settings.",
    };
  }

  if (location.is_active === false) {
    return {
      status: "inactive",
      isInside: false,
      isOutside: false,
      canCheckIn: false,
      canCheckOutWhenCheckedIn: false,
      distanceMeters: null,
      hysteresisMeters: 0,
      effectiveExitThresholdMeters: null,
      headline: "Office geofence is currently inactive.",
      reason: `${location.name} geofencing is paused by HR Admin.`,
    };
  }

  if (permissionDenied) {
    return {
      status: "permission_denied",
      isInside: false,
      isOutside: false,
      canCheckIn: false,
      canCheckOutWhenCheckedIn: false,
      distanceMeters: null,
      hysteresisMeters: 0,
      effectiveExitThresholdMeters: null,
      headline: "Unable to detect your location.",
      reason: "Location permission was denied. Enable location access and retry.",
    };
  }

  if (gpsDisabled) {
    return {
      status: "gps_disabled",
      isInside: false,
      isOutside: false,
      canCheckIn: false,
      canCheckOutWhenCheckedIn: false,
      distanceMeters: null,
      hysteresisMeters: 0,
      effectiveExitThresholdMeters: null,
      headline: "Unable to detect your location.",
      reason: "Device GPS / location services appear disabled. Turn on location services and retry.",
    };
  }

  if (!coords) {
    return {
      status: "unavailable",
      isInside: false,
      isOutside: false,
      canCheckIn: false,
      canCheckOutWhenCheckedIn: false,
      distanceMeters: null,
      hysteresisMeters: 0,
      effectiveExitThresholdMeters: null,
      headline: "Unable to detect your location.",
      reason: "Waiting for a verified GPS reading from your device.",
    };
  }

  if (coords.isMock) {
    return {
      status: "mock_detected",
      isInside: false,
      isOutside: false,
      canCheckIn: false,
      canCheckOutWhenCheckedIn: false,
      distanceMeters: null,
      hysteresisMeters: 0,
      effectiveExitThresholdMeters: null,
      headline: "Unable to detect your location.",
      reason: "Simulated or mock GPS location detected. Disable mock location apps to record attendance.",
    };
  }

  const coordCheck = validateCoordinates(coords.latitude, coords.longitude);
  const locCheck = validateCoordinates(location.latitude, location.longitude);
  const radiusCheck = validateRadiusMeters(location.radius_meters);
  if (!coordCheck.valid || !locCheck.valid || !radiusCheck.valid) {
    return {
      status: "unavailable",
      isInside: false,
      isOutside: false,
      canCheckIn: false,
      canCheckOutWhenCheckedIn: false,
      distanceMeters: null,
      hysteresisMeters: 0,
      effectiveExitThresholdMeters: null,
      headline: "Unable to detect your location.",
      reason: coordCheck.reason ?? locCheck.reason ?? radiusCheck.reason ?? "Invalid geofence coordinates.",
    };
  }

  const distanceMeters = calculateHaversineDistance(
    coords.latitude,
    coords.longitude,
    location.latitude,
    location.longitude,
  );

  if (!Number.isFinite(coords.accuracy) || coords.accuracy <= 0 || coords.accuracy > maxAccuracyMeters) {
    return {
      status: "poor_accuracy",
      isInside: false,
      isOutside: false,
      canCheckIn: false,
      canCheckOutWhenCheckedIn: false,
      distanceMeters,
      hysteresisMeters: 0,
      effectiveExitThresholdMeters: null,
      headline: "Unable to detect your location.",
      reason: `GPS signal accuracy (±${Math.round(coords.accuracy)}m) exceeds ${maxAccuracyMeters}m tolerance. Retry in an open area.`,
    };
  }

  const readingAgeMs = nowMs - coords.timestamp;
  if (!Number.isFinite(coords.timestamp) || readingAgeMs > maxAgeMs) {
    return {
      status: "stale_reading",
      isInside: false,
      isOutside: false,
      canCheckIn: false,
      canCheckOutWhenCheckedIn: false,
      distanceMeters,
      hysteresisMeters: 0,
      effectiveExitThresholdMeters: null,
      headline: "Unable to detect your location.",
      reason: "GPS fix is stale. Tap Retry Location to acquire a fresh position.",
    };
  }

  const hysteresisMeters = getHysteresisBufferMeters(location.radius_meters, hysteresisOverride);
  const effectiveExitThresholdMeters = location.radius_meters + hysteresisMeters;

  const isInside = previouslyInside
    ? distanceMeters <= effectiveExitThresholdMeters
    : distanceMeters <= location.radius_meters;

  if (isInside) {
    return {
      status: "inside",
      isInside: true,
      isOutside: false,
      canCheckIn: true,
      canCheckOutWhenCheckedIn: false,
      distanceMeters,
      hysteresisMeters,
      effectiveExitThresholdMeters,
      headline: "You are inside the office area.",
      reason: `Within ${location.name} geofence (${formatDistance(distanceMeters)} / ${location.radius_meters}m allowed).`,
    };
  }

  return {
    status: "outside",
    isInside: false,
    isOutside: true,
    canCheckIn: false,
    canCheckOutWhenCheckedIn: true,
    distanceMeters,
    hysteresisMeters,
    effectiveExitThresholdMeters,
    headline: "You are outside the office area.",
    reason: `Currently ${formatDistance(distanceMeters)} from ${location.name} (allowed radius: ${location.radius_meters}m).`,
  };
}

/**
 * Format coordinates nicely with Cardinal directions
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
}

/**
 * Promisified browser geolocation helper with configurable parameters
 */
function getBrowserPosition(options: PositionOptions): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return reject(
        new GeolocationAcquisitionError(
          "UNSUPPORTED",
          "Geolocation is not supported by your browser or operating system.",
        ),
      );
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now(),
          isMock: false,
          source: options.enableHighAccuracy ? "browser_gps" : "browser_network",
        });
      },
      (err) => {
        if (err.code === 1) {
          reject(
            new GeolocationAcquisitionError(
              "PERMISSION_DENIED",
              "Location permission denied. Please enable location access in browser or device settings.",
            ),
          );
          return;
        }
        if (err.code === 2) {
          reject(
            new GeolocationAcquisitionError(
              "GPS_DISABLED",
              "Location signal unavailable. Check that GPS / device location services are enabled.",
            ),
          );
          return;
        }
        if (err.code === 3) {
          reject(
            new GeolocationAcquisitionError(
              "TIMEOUT",
              "Timed out while acquiring GPS signal. Please move to a clearer area and retry.",
            ),
          );
          return;
        }
        reject(
          new GeolocationAcquisitionError(
            "UNAVAILABLE",
            err.message || "Unable to acquire GPS coordinates.",
          ),
        );
      },
      options,
    );
  });
}

function isMockNativePosition(pos: unknown): boolean {
  if (!pos || typeof pos !== "object") return false;
  const candidate = pos as { mock?: boolean; isMock?: boolean; coords?: { mock?: boolean; isMock?: boolean } };
  return (
    candidate.mock === true ||
    candidate.isMock === true ||
    candidate.coords?.mock === true ||
    candidate.coords?.isMock === true
  );
}

/**
 * Get device horizontal position from native Capacitor GPS or Browser Geolocation.
 * Never fabricates high-accuracy fixes from coarse IP addresses.
 */
export async function getCurrentDevicePosition(): Promise<Coordinates> {
  // Tier 1: Native Capacitor Geolocation (Android / iOS)
  if (
    typeof window !== "undefined" &&
    (
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor?.isNativePlatform?.()
  ) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const status = await Geolocation.checkPermissions();
    let granted = status.location === "granted" || status.coarseLocation === "granted";

    if (!granted) {
      const requested = await Geolocation.requestPermissions();
      granted = requested.location === "granted" || requested.coarseLocation === "granted";
    }

    if (!granted) {
      throw new GeolocationAcquisitionError(
        "PERMISSION_DENIED",
        "Location permission is required. Please enable location access in app settings.",
      );
    }

    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp || Date.now(),
        isMock: isMockNativePosition(pos),
        source: "native_gps",
      };
    } catch (nativeErr: unknown) {
      const message =
        nativeErr instanceof Error ? nativeErr.message : "Native GPS is disabled or unavailable.";
      if (/denied|permission/i.test(message)) {
        throw new GeolocationAcquisitionError("PERMISSION_DENIED", message);
      }
      if (/disabled|off|unavailable/i.test(message)) {
        throw new GeolocationAcquisitionError("GPS_DISABLED", message);
      }
      throw new GeolocationAcquisitionError("UNAVAILABLE", message);
    }
  }

  // Tier 2: Browser High-Accuracy GPS first (8s timeout, 10s cache)
  try {
    return await getBrowserPosition({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 10000,
    });
  } catch (err: unknown) {
    if (err instanceof GeolocationAcquisitionError && err.code === "PERMISSION_DENIED") {
      throw err;
    }
  }

  // Tier 3: Browser Standard Positioning fallback (Wi-Fi / Cell tower, 10s timeout)
  return await getBrowserPosition({
    enableHighAccuracy: false,
    timeout: 10000,
    maximumAge: 15000,
  });
}

/**
 * Query current employee's geofencing context (assigned location, shift, today's attendance).
 */
export async function fetchEmployeeGeofenceContext(): Promise<GeofenceContext> {
  const { data, error } = await supabase.rpc("get_employee_geofence_context");
  if (error) {
    throw new Error(error.message || "Failed to load employee geofence context");
  }
  if (!data || (data as { error?: string }).error) {
    throw new Error((data as { error?: string })?.error || "No geofence context available");
  }
  return data as unknown as GeofenceContext;
}

/**
 * Execute server-verified attendance submission through Supabase Edge Function `verify-attendance`.
 * Requires valid Supabase Auth session JWT; never writes attendance directly from client.
 */
export async function submitGeofenceAttendance(
  action: "check_in" | "check_out",
  coords: Coordinates,
  deviceId?: string,
): Promise<{
  success: boolean;
  action: string;
  time: string;
  status?: string;
  total_hours?: number;
  location_name: string;
  distance_meters: number;
  allowed_radius?: number;
  source?: string;
}> {
  let resolvedDeviceId = deviceId;
  if (!resolvedDeviceId && typeof window !== "undefined") {
    try {
      const { getMobileDeviceInfo } = await import("@/lib/mobile-geofence");
      const info = await getMobileDeviceInfo();
      resolvedDeviceId = info.uuid;
    } catch {
      resolvedDeviceId = undefined;
    }
  }

  const { data, error } = await supabase.functions.invoke("verify-attendance", {
    body: {
      action,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      timestamp: coords.timestamp,
      is_mock: coords.isMock === true,
      device_id: resolvedDeviceId ?? null,
      location_source: coords.source ?? "browser_gps",
    },
  });

  if (error) {
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const errPayload = (await context.clone().json()) as { error?: string; code?: string };
        if (errPayload?.error) {
          throw new Error(errPayload.error);
        }
      } catch (parseOrMessageErr) {
        if (parseOrMessageErr instanceof Error && parseOrMessageErr.message !== "Unexpected end of JSON input") {
          throw parseOrMessageErr;
        }
      }
    }

    const msg = error.message || "Attendance verification failed";
    if (/Failed to send a request to the Edge Function|404|NOT_FOUND/i.test(msg)) {
      throw new Error(
        "Attendance verification service ('verify-attendance' Edge Function) is unreachable. Ensure the Edge Function is deployed in Supabase.",
      );
    }
    throw new Error(msg);
  }

  const res = data as Record<string, unknown> | null;
  if (!res || res["success"] !== true) {
    throw new Error((res?.["error"] as string) || "Server rejected attendance verification");
  }

  return res as {
    success: boolean;
    action: string;
    time: string;
    status?: string;
    total_hours?: number;
    location_name: string;
    distance_meters: number;
    allowed_radius?: number;
    source?: string;
  };
}
