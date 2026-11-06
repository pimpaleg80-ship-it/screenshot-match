import { supabase } from "@/integrations/supabase/client";

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isMock?: boolean;
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
 * Get device horizontal position using standard Geolocation API or Capacitor Geolocation.
 */
export async function getCurrentDevicePosition(): Promise<Coordinates> {
  // Check if Capacitor Geolocation is available in native runtime
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
        timeout: 10000,
        maximumAge: 5000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      };
    } catch {
      // Fallback to browser geolocation
    }
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation is not supported by your browser or operating system.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        let msg = "Could not retrieve GPS coordinates.";
        if (err.code === err.PERMISSION_DENIED) {
          msg =
            "Location permission denied. Please allow GPS access in your browser or device settings.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "GPS signal unavailable. Please ensure location services are enabled.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Location request timed out. Please check signal and retry.";
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
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
