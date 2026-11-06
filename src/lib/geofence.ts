import { supabase } from "@/integrations/supabase/client";

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isMock?: boolean;
  source?:
    | "native_gps"
    | "browser_gps"
    | "browser_network"
    | "edge_cloudflare"
    | "edge_supabase"
    | "ip_fallback";
  city?: string;
}

export interface GeofenceLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
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

/**
 * Reusable Haversine distance formula (in meters) between two WGS-84 coordinate points.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
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
  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));

  return R * c;
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
 * Promisified browser geolocation helper with configurable parameters
 */
function getBrowserPosition(options: PositionOptions): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return reject(new Error("Geolocation is not supported by your browser or operating system."));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
          source: options.enableHighAccuracy ? "browser_gps" : "browser_network",
        });
      },
      (err) => {
        reject(err);
      },
      options,
    );
  });
}

/**
 * Fallback to Cloudflare Pages edge route or Supabase Edge Function when GPS is unavailable.
 */
async function getEdgeNetworkPosition(): Promise<Coordinates> {
  // 1. Try local Cloudflare Pages /api/location endpoint
  try {
    const res = await fetch("/api/location", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy || 75,
          timestamp: data.timestamp || Date.now(),
          source: "edge_cloudflare",
          city: data.city,
        };
      }
    }
  } catch {
    // Continue to Supabase edge function
  }

  // 2. Try Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke("get-client-location");
    if (!error && data && typeof data.latitude === "number" && typeof data.longitude === "number") {
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy || 75,
        timestamp: data.timestamp || Date.now(),
        source: "edge_supabase",
        city: data.city,
      };
    }
  } catch {
    // Continue to direct IP API
  }

  // 3. Try direct public IP lookup
  try {
    const res = await fetch("https://freeipapi.com/api/json");
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return {
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          accuracy: 80,
          timestamp: Date.now(),
          source: "ip_fallback",
          city: data.cityName,
        };
      }
    }
  } catch {
    // End of fallbacks
  }

  throw new Error("Unable to determine location from GPS or network. Please check your network and location settings.");
}

/**
 * Get device horizontal position using resilient multi-tier acquisition:
 * Tier 1: Native Capacitor Geolocation (mobile apps)
 * Tier 2: Browser High-Accuracy GPS (satellites/device sensor)
 * Tier 3: Browser Standard-Accuracy Network Positioning (Wi-Fi/cell tower)
 * Tier 4: Edge / Network IP Geolocation Fallback (Cloudflare Pages / Supabase Edge Function)
 */
export async function getCurrentDevicePosition(): Promise<Coordinates> {
  // Tier 1: Check if Capacitor Geolocation is available in native runtime
  if (
    typeof window !== "undefined" &&
    (
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor?.isNativePlatform?.()
  ) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
        source: "native_gps",
      };
    } catch {
      // Fallback to browser geolocation
    }
  }

  // Tier 2: Try Browser High-Accuracy GPS first (7s timeout, 15s cache)
  try {
    return await getBrowserPosition({
      enableHighAccuracy: true,
      timeout: 7000,
      maximumAge: 15000,
    });
  } catch (err: unknown) {
    const geoErr = err as { code?: number };
    // If user explicitly denied permission, do not silently fallback without prompt
    if (geoErr?.code === 1) { // PERMISSION_DENIED
      throw new Error("Location permission denied. Please click the lock or site settings icon in your browser address bar to allow location access.");
    }
    // If code 2 (POSITION_UNAVAILABLE) or code 3 (TIMEOUT), proceed to Tier 3
  }

  // Tier 3: Try Standard-Accuracy Network Positioning (Wi-Fi / Cell tower)
  try {
    return await getBrowserPosition({
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    });
  } catch (err: unknown) {
    const geoErr = err as { code?: number };
    if (geoErr?.code === 1) {
      throw new Error("Location permission denied. Please allow location access in your browser.");
    }
    // If code 2 or 3, proceed to Tier 4
  }

  // Tier 4: Edge / Cloudflare / Supabase IP Geolocation Fallback
  try {
    return await getEdgeNetworkPosition();
  } catch (fallbackErr: unknown) {
    throw new Error(
      "GPS signal and network location are unavailable. Please ensure location services are enabled in your device settings and refresh.",
    );
  }
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
 * Execute verified attendance action (manual check_in or check_out) gated by native geofence coordinates.
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
}> {
  const { data, error } = await supabase.rpc("verify_and_record_attendance", {
    p_action: action,
    p_lat: coords.latitude,
    p_lon: coords.longitude,
    p_accuracy: coords.accuracy,
    p_device_id: deviceId || "web-client",
  });

  if (error) {
    throw new Error(error.message || `Failed to record ${action}`);
  }

  return data as {
    success: boolean;
    action: string;
    time: string;
    status?: string;
    total_hours?: number;
    location_name: string;
    distance_meters: number;
  };
}
